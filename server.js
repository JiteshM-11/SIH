// Co-Pilot Swarm — backend API
// Express + better-sqlite3 + bcrypt + jsonwebtoken
//
// Provides:
//   - User signup/login (bcrypt-hashed passwords, JWT-based sessions)
//   - Persistence for the swarm simulation: hazard flares, EV pre-conditioning
//     stats, safety tokens / leaderboard, and the live activity feed —
//     all scoped per logged-in user.
//
// Run with:  node server.js
// Default port: 4000 (override with PORT env var)

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'swarm.db');

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS flares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_name TEXT NOT NULL,
    zone TEXT NOT NULL,
    lat REAL,
    lng REAL,
    is_ev INTEGER NOT NULL DEFAULT 0,
    ev_range_recovered REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS token_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    is_you INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feed_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    color TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_flares_user ON flares(user_id);
  CREATE INDEX IF NOT EXISTS idx_tokens_user ON token_awards(user_id);
  CREATE INDEX IF NOT EXISTS idx_feed_user ON feed_events(user_id);
`);

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const cleanUsername = username.trim();
  if (cleanUsername.length < 3 || cleanUsername.length > 32) {
    return res.status(400).json({ error: 'username must be 3-32 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'username already taken' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(cleanUsername, passwordHash);

  const user = { id: info.lastInsertRowid, username: cleanUsername };
  const token = signToken(user);
  res.status(201).json({ token, user });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!row) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  const user = { id: row.id, username: row.username };
  const token = signToken(user);
  res.json({ token, user });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// Swarm simulation state — scoped per authenticated user
// ---------------------------------------------------------------------------

// GET /api/swarm/state — full snapshot used to repopulate the UI on load
app.get('/api/swarm/state', requireAuth, (req, res) => {
  const userId = req.user.id;

  const flareCount = db.prepare('SELECT COUNT(*) AS c FROM flares WHERE user_id = ?').get(userId).c;

  const zoneRows = db
    .prepare(`SELECT zone, COUNT(*) AS count FROM flares WHERE user_id = ? GROUP BY zone ORDER BY count DESC`)
    .all(userId);
  const stressZones = {};
  zoneRows.forEach(r => { stressZones[r.zone] = r.count; });

  const evRow = db
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(ev_range_recovered),0) AS rangeSum
              FROM flares WHERE user_id = ? AND is_ev = 1`)
    .get(userId);

  const tokenTotalRow = db
    .prepare('SELECT COALESCE(SUM(amount),0) AS total FROM token_awards WHERE user_id = ?')
    .get(userId);

  const yourTokensRow = db
    .prepare('SELECT COALESCE(SUM(amount),0) AS total FROM token_awards WHERE user_id = ? AND is_you = 1')
    .get(userId);

  const driverRows = db
    .prepare(`SELECT driver_name AS name, SUM(amount) AS pts
              FROM token_awards WHERE user_id = ? AND is_you = 0
              GROUP BY driver_name ORDER BY pts DESC LIMIT 5`)
    .all(userId);

  const feed = db
    .prepare(`SELECT group_name AS "group", color, message, created_at
              FROM feed_events WHERE user_id = ? ORDER BY id DESC LIMIT 50`)
    .all(userId);

  res.json({
    flares: { total: flareCount, stressZones },
    ev: {
      count: evRow.count,
      avgRangeRecovered: evRow.count > 0 ? evRow.rangeSum / evRow.count : 0
    },
    tokens: {
      total: tokenTotalRow.total,
      you: yourTokensRow.total,
      leaderboard: driverRows
    },
    feed
  });
});

// POST /api/swarm/flares — record a dropped hazard flare
app.post('/api/swarm/flares', requireAuth, (req, res) => {
  const { vehicleName, zone, lat, lng, isEV, evRangeRecovered } = req.body || {};
  if (typeof vehicleName !== 'string' || typeof zone !== 'string') {
    return res.status(400).json({ error: 'vehicleName and zone are required' });
  }

  const info = db
    .prepare(`INSERT INTO flares (user_id, vehicle_name, zone, lat, lng, is_ev, ev_range_recovered)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      req.user.id,
      vehicleName,
      zone,
      typeof lat === 'number' ? lat : null,
      typeof lng === 'number' ? lng : null,
      isEV ? 1 : 0,
      typeof evRangeRecovered === 'number' ? evRangeRecovered : null
    );

  res.status(201).json({ id: info.lastInsertRowid });
});

// POST /api/swarm/tokens — award safety tokens to a driver
app.post('/api/swarm/tokens', requireAuth, (req, res) => {
  const { driverName, amount, isYou, reason } = req.body || {};
  if (typeof driverName !== 'string' || typeof amount !== 'number') {
    return res.status(400).json({ error: 'driverName and amount are required' });
  }

  const info = db
    .prepare(`INSERT INTO token_awards (user_id, driver_name, amount, is_you, reason)
              VALUES (?, ?, ?, ?, ?)`)
    .run(req.user.id, driverName, amount, isYou ? 1 : 0, reason || null);

  res.status(201).json({ id: info.lastInsertRowid });
});

// POST /api/swarm/feed — append an activity feed entry
app.post('/api/swarm/feed', requireAuth, (req, res) => {
  const { group, color, message } = req.body || {};
  if (typeof group !== 'string' || typeof color !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'group, color and message are required' });
  }

  const info = db
    .prepare(`INSERT INTO feed_events (user_id, group_name, color, message) VALUES (?, ?, ?, ?)`)
    .run(req.user.id, group, color, message);

  res.status(201).json({ id: info.lastInsertRowid });
});

// DELETE /api/swarm/state — reset all simulation data for this user
app.delete('/api/swarm/state', requireAuth, (req, res) => {
  const userId = req.user.id;
  db.prepare('DELETE FROM flares WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM token_awards WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM feed_events WHERE user_id = ?').run(userId);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Health check + error handling
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ error: 'not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Co-Pilot Swarm backend listening on http://localhost:${PORT}`);
});
