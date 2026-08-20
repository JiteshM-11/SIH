const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { findUserByEmail, insertUser } = require('../lib/store');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { buildMetrics } = require('../lib/metrics');

const router = express.Router();

function makePassportId() {
  const n = crypto.randomInt(10000, 99999);
  return `CP-${n}`;
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function sign(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '2h' });
}

router.post('/signup', async (req, res) => {
  const { name, email, password, batteryType, purchaseDate } = req.body || {};
  if (!name || !email || !password || !batteryType || !purchaseDate) {
    return res.status(400).json({ error: 'name, email, password, batteryType, purchaseDate are all required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    name, email, passwordHash, batteryType, purchaseDate,
    passportId: makePassportId(),
    verification: 'estimated',
    createdAt: new Date().toISOString(),
  };
  insertUser(user);

  const token = sign(user);
  res.status(201).json({ token, user: publicUser(user), metrics: buildMetrics(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const token = sign(user);
  res.json({ token, user: publicUser(user), metrics: buildMetrics(user) });
});

// Stateless JWT — nothing to invalidate server-side without a token
// blacklist/store, so this exists mainly for symmetry with the client flow.
router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), metrics: buildMetrics(req.user) });
});

module.exports = router;
