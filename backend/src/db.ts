import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const DB_PATH = path.join(DATA_DIR, 'sleep.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS readings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp  TEXT    NOT NULL,
    co2        REAL    NOT NULL,
    temp_f     REAL    NOT NULL,
    humidity   REAL    NOT NULL,
    noise      REAL    NOT NULL,
    lux        REAL    NOT NULL,
    score      REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_readings_user_ts
    ON readings(user_id, timestamp DESC);
`)

export default db
