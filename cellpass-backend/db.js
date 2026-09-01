// db.js
// Sets up a local SQLite database file (cellpass.db) and makes sure
// the "users" table exists. better-sqlite3 is synchronous and simple,
// which is why it's a good fit for learning / small projects.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'cellpass.db'));

// Create the users table the first time the server runs.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    passwordHash  TEXT    NOT NULL,
    batteryType   TEXT,
    purchaseDate  TEXT,
    createdAt     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

module.exports = db;
