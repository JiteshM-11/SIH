// server.js
// Entry point. Starts Express, serves the frontend from /public,
// and mounts the auth API under /api.

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4471;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,        // reflect the request origin (fine for local dev / same-origin setup below)
  credentials: true,   // allow cookies to be sent
}));

// API routes
app.use('/api', authRoutes);

// Serve the frontend (index.html, style.css, script.js, image) as static files.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`CellPass server running at http://localhost:${PORT}`);
});
