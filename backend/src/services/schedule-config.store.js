import { db } from '../db/client.js'

export const DEFAULT_SCHEDULING_CONFIG = Object.freeze({
  enabled: 1,
  open_day: 3,
  open_hour: 20,
  open_minute: 0,
  close_day: 5,
  close_hour: 20,
  close_minute: 0,
  auto_settle: 1
})

export function ensureSchedulingConfigTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduling_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 1,
      open_day INTEGER NOT NULL DEFAULT 3,
      open_hour INTEGER NOT NULL DEFAULT 20,
      open_minute INTEGER NOT NULL DEFAULT 0,
      close_day INTEGER NOT NULL DEFAULT 5,
      close_hour INTEGER NOT NULL DEFAULT 20,
      close_minute INTEGER NOT NULL DEFAULT 0,
      auto_settle INTEGER NOT NULL DEFAULT 1,
      last_auto_open_at TEXT,
      last_auto_close_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export function getPersistedSchedulingConfig() {
  ensureSchedulingConfigTable()

  const row = db.prepare('SELECT * FROM scheduling_config WHERE id = 1').get()
  if (row) return row

  db.prepare(`
    INSERT INTO scheduling_config (
      id,
      enabled,
      open_day,
      open_hour,
      open_minute,
      close_day,
      close_hour,
      close_minute,
      auto_settle
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    1,
    DEFAULT_SCHEDULING_CONFIG.enabled,
    DEFAULT_SCHEDULING_CONFIG.open_day,
    DEFAULT_SCHEDULING_CONFIG.open_hour,
    DEFAULT_SCHEDULING_CONFIG.open_minute,
    DEFAULT_SCHEDULING_CONFIG.close_day,
    DEFAULT_SCHEDULING_CONFIG.close_hour,
    DEFAULT_SCHEDULING_CONFIG.close_minute,
    DEFAULT_SCHEDULING_CONFIG.auto_settle
  )

  return db.prepare('SELECT * FROM scheduling_config WHERE id = 1').get()
}
