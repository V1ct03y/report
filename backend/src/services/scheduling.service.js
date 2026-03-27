import cron from 'node-cron'
import { db } from '../db/client.js'
import { currentSqlTimestamp } from './cycle-lifecycle.service.js'
import { settleCycle } from './settlement.service.js'

// ─── Config ──────────────────────────────────────────────────────────────────

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
  if (!row) {
    db.prepare(`
      INSERT INTO scheduling_config (id, enabled, open_day, open_hour, open_minute, close_day, close_hour, close_minute, auto_settle)
      VALUES (1, 1, 3, 20, 0, 5, 20, 0, 1)
    `).run()
    return getSchedulingConfig()
  }
  return row
}

export function updateSchedulingConfig(patch) {
  const allowed = ['enabled', 'open_day', 'open_hour', 'open_minute', 'close_day', 'close_hour', 'close_minute', 'auto_settle']
  const fields = []
  const values = []
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.includes(k)) {
      fields.push(`${k} = ?`)
      values.push(Number(v))
    }
  }
  if (!fields.length) return getSchedulingConfig()

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(1)
  db.prepare(`UPDATE scheduling_config SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getSchedulingConfig()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function formatScheduleDesc(config) {
  const openDay = WEEKDAY_NAMES[config.open_day] || `周${config.open_day}`
  const closeDay = WEEKDAY_NAMES[config.close_day] || `周${config.close_day}`
  const openTime = `${String(config.open_hour).padStart(2, '0')}:${String(config.open_minute).padStart(2, '0')}`
  const closeTime = `${String(config.close_hour).padStart(2, '0')}:${String(config.close_minute).padStart(2, '0')}`
  return `${openDay} ${openTime} 自动开启 → ${closeDay} ${closeTime} 自动结算并开启下一周期`
}

// dayjs-like ISO weekday (Mon=1, Sun=7)
function toISOWeekday(d) {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

function timeMatches(now, day, hour, minute) {
  return toISOWeekday(now) === day
    && now.getHours() === hour
    && now.getMinutes() === minute
    && now.getSeconds() < 5
}

function formatSqlTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function makeWeekName(weekNumber) {
  return `第${weekNumber}周工作评分`
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CYCLE_DURATION_MS = 2 * 24 * 60 * 60 * 1000

function getNextOpenDate(config, from = new Date()) {
  const local = new Date(from)
  local.setSeconds(0, 0)
  const todayWeekday = toISOWeekday(local)

  const targetWeekday = config.open_day
  const targetHour = config.open_hour
  const targetMinute = config.open_minute

  let daysUntil = targetWeekday - todayWeekday
  if (daysUntil < 0) daysUntil += 7
  if (daysUntil === 0) {
    const targetTime = new Date(
      local.getFullYear(), local.getMonth(), local.getDate(),
      targetHour, targetMinute, 0, 0
    )
    if (local >= targetTime) daysUntil = 7
  }

  const result = new Date(
    local.getFullYear(), local.getMonth(), local.getDate() + daysUntil,
    targetHour, targetMinute, 0, 0
  )
  return result
}

function getNextCloseDate(config, from = new Date()) {
  const local = new Date(from)
  local.setSeconds(0, 0)
  const todayWeekday = toISOWeekday(local)

  const targetWeekday = config.close_day
  const targetHour = config.close_hour
  const targetMinute = config.close_minute

  let daysUntil = targetWeekday - todayWeekday
  if (daysUntil < 0) daysUntil += 7
  if (daysUntil === 0) {
    const targetTime = new Date(
      local.getFullYear(), local.getMonth(), local.getDate(),
      targetHour, targetMinute, 0, 0
    )
    if (local >= targetTime) daysUntil = 7
  }

  const result = new Date(
    local.getFullYear(), local.getMonth(), local.getDate() + daysUntil,
    targetHour, targetMinute, 0, 0
  )
  return result
}

export function getNextScheduledEvents(from = new Date()) {
  const config = getSchedulingConfig()
  const openDate = getNextOpenDate(config, from)
  const closeDate = getNextCloseDate(config, from)
  return { openDate: openDate.toISOString(), closeDate: closeDate.toISOString() }
}

// ─── Cycle auto-open ──────────────────────────────────────────────────────────

function autoOpenCycle(config) {
  const startDate = new Date()
  startDate.setSeconds(0, 0)
  const endDate = new Date(startDate.getTime() + CYCLE_DURATION_MS)

  const startSql = formatSqlTime(startDate)
  const endSql = formatSqlTime(endDate)

  const existing = db.prepare('SELECT * FROM rating_cycles WHERE start_at = ? OR end_at = ?').all(startSql, endSql)
  if (existing.length) {
    return null
  }

  const maxWeek = db.prepare('SELECT MAX(week_number) as m FROM rating_cycles').get()?.m || 0
  const nextWeek = maxWeek + 1

  db.prepare(`
    INSERT INTO rating_cycles (name, week_number, start_at, end_at, status, public_at, is_archived, settle_mode)
    VALUES (?, ?, ?, ?, 'draft', NULL, 0, 'automatic')
  `).run(makeWeekName(nextWeek), nextWeek, startSql, endSql)

  db.prepare(`UPDATE scheduling_config SET last_auto_open_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(startSql)

  return db.prepare('SELECT * FROM rating_cycles WHERE start_at = ?').get(startSql)
}

// ─── Cycle auto-settle ────────────────────────────────────────────────────────

function autoSettleCycle(config) {
  const candidates = db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status IN ('draft', 'active', 'closed')
      AND end_at IS NOT NULL
      AND end_at <= ?
    ORDER BY week_number ASC, id ASC
    LIMIT 1
  `).all(currentSqlTimestamp())

  if (!candidates.length) return null

  const cycle = candidates[0]
  settleCycle(cycle.id, 'automatic')

  db.prepare(`UPDATE scheduling_config SET last_auto_close_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
    .run(cycle.settled_at || currentSqlTimestamp())

  return cycle
}

// ─── Cron job ─────────────────────────────────────────────────────────────────

let schedulerTask = null

export function startScheduler() {
  if (schedulerTask) return
  schedulerTask = cron.schedule('* * * * *', () => {
    const config = getSchedulingConfig()
    if (!config.enabled) return

    const now = new Date()

    if (timeMatches(now, config.open_day, config.open_hour, config.open_minute)) {
      const lastOpen = config.last_auto_open_at ? new Date(config.last_auto_open_at.replace(' ', 'T')) : null
      const alreadyOpened = lastOpen && now.getFullYear() === lastOpen.getFullYear()
        && now.getMonth() === lastOpen.getMonth()
        && now.getDate() === lastOpen.getDate()

      if (!alreadyOpened) {
        autoOpenCycle(config)
      }
    }

    if (timeMatches(now, config.close_day, config.close_hour, config.close_minute)) {
      const lastClose = config.last_auto_close_at ? new Date(config.last_auto_close_at.replace(' ', 'T')) : null
      const alreadyClosed = lastClose && now.getFullYear() === lastClose.getFullYear()
        && now.getMonth() === lastClose.getMonth()
        && now.getDate() === lastClose.getDate()

      if (!alreadyClosed) {
        autoSettleCycle(config)
        if (config.auto_settle) {
          autoOpenCycle(config)
        }
      }
    }
  })
  console.log('[Scheduler] Cron job started')
}

export function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop()
    schedulerTask = null
    console.log('[Scheduler] Cron job stopped')
  }
}
