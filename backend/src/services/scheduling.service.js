import cron from 'node-cron'
import { db } from '../db/client.js'
import { currentSqlTimestamp, reconcileCycleTimeline } from './cycle-lifecycle.service.js'

export function getSchedulingConfig() {
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
    VALUES (1, 1, 3, 20, 0, 5, 20, 0, 1)
  `).run()

  return getSchedulingConfig()
}

export function updateSchedulingConfig(patch) {
  const allowed = ['enabled', 'open_day', 'open_hour', 'open_minute', 'close_day', 'close_hour', 'close_minute', 'auto_settle']
  const fields = []
  const values = []

  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.includes(key)) continue
    fields.push(`${key} = ?`)
    values.push(Number(value))
  }

  if (!fields.length) return getSchedulingConfig()

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(1)
  db.prepare(`UPDATE scheduling_config SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return getSchedulingConfig()
}

const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function formatScheduleDesc(config) {
  const openDay = WEEKDAY_NAMES[config.open_day] || `周${config.open_day}`
  const closeDay = WEEKDAY_NAMES[config.close_day] || `周${config.close_day}`
  const openTime = `${String(config.open_hour).padStart(2, '0')}:${String(config.open_minute).padStart(2, '0')}`
  const closeTime = `${String(config.close_hour).padStart(2, '0')}:${String(config.close_minute).padStart(2, '0')}`
  return `${openDay} ${openTime} 自动开周期，${closeDay} ${closeTime} 自动截止`
}

function toISOWeekday(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function getNextEventDate(targetDay, targetHour, targetMinute, from = new Date()) {
  const local = new Date(from)
  local.setSeconds(0, 0)
  const todayWeekday = toISOWeekday(local)

  let daysUntil = targetDay - todayWeekday
  if (daysUntil < 0) daysUntil += 7

  if (daysUntil === 0) {
    const targetTime = new Date(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      targetHour,
      targetMinute,
      0,
      0
    )
    if (local >= targetTime) {
      daysUntil = 7
    }
  }

  return new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + daysUntil,
    targetHour,
    targetMinute,
    0,
    0
  )
}

export function getNextScheduledEvents(from = new Date()) {
  const config = getSchedulingConfig()
  return {
    openDate: getNextEventDate(config.open_day, config.open_hour, config.open_minute, from).toISOString(),
    closeDate: getNextEventDate(config.close_day, config.close_hour, config.close_minute, from).toISOString()
  }
}

let schedulerTask = null

export function startScheduler() {
  if (schedulerTask) return

  schedulerTask = cron.schedule('* * * * *', () => {
    reconcileCycleTimeline(currentSqlTimestamp())
  })

  reconcileCycleTimeline(currentSqlTimestamp())
  console.log('[Scheduler] Cron job started')
}

export function stopScheduler() {
  if (!schedulerTask) return
  schedulerTask.stop()
  schedulerTask = null
  console.log('[Scheduler] Cron job stopped')
}
