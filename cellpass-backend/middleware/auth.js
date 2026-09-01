// middleware/auth.js
// Reads the "token" cookie set at login, verifies it, and attaches
// the decoded user info to req.user. If there's no valid token,
// it responds 401 instead of letting the request continue.

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

module.exports = { requireAuth };
