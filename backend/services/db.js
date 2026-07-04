/**
 * Minimal JSON-file datastore.
 * Keeps the project runnable with zero external database setup while still
 * persisting interview history / analytics between server restarts.
 * Swap this out for MongoDB/Postgres in production without touching routes
 * (interface: read(), write(data)).
 */
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function read() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ sessions: [], users: [] }, null, 2));
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { sessions: [], users: [] };
  }
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { read, write };
