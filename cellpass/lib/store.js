// Minimal JSON-file datastore. Good enough for a demo/backend without
// requiring native modules (sqlite) that need compiling on install.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw || '{"users":[]}');
  } catch {
    return { users: [] };
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function findUserByEmail(email) {
  const db = readDb();
  return db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
}

function findUserById(id) {
  const db = readDb();
  return db.users.find(u => u.id === id);
}

function findUserByPassportId(passportId) {
  const db = readDb();
  return db.users.find(u => u.passportId === passportId);
}

function insertUser(user) {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

function updateUser(id, patch) {
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...patch };
  writeDb(db);
  return db.users[idx];
}

module.exports = {
  readDb, writeDb,
  findUserByEmail, findUserById, findUserByPassportId,
  insertUser, updateUser,
};
