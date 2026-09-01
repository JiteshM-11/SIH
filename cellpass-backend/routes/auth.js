// routes/auth.js
// All account-related endpoints: create account, log in, log out,
// and "who am I" (used on page load to restore a session).

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,      // JS on the page can't read the cookie (protects against XSS token theft)
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production', // only over HTTPS in production
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  // Never send passwordHash back to the browser.
  const { passwordHash, ...safe } = user;
  return safe;
}

/* ---------------- POST /api/signup ---------------- */
router.post('/signup', (req, res) => {
  const { name, email, password, batteryType, purchaseDate } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO users (name, email, passwordHash, batteryType, purchaseDate)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email.toLowerCase(), passwordHash, batteryType || null, purchaseDate || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  const token = signToken(user);
  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ user: publicUser(user) });
});

/* ---------------- POST /api/login ---------------- */
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken(user);
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ user: publicUser(user) });
});

/* ---------------- POST /api/logout ---------------- */
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ ok: true });
});

/* ---------------- GET /api/me ---------------- */
// Used on page load to check "is someone already logged in?" via the cookie.
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'User no longer exists.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
