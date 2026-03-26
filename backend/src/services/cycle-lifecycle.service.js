import { db } from '../db/client.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CYCLE_DURATION_MS = 2 * 24 * 60 * 60 * 1000

function makeWeekName(weekNumber) {
  return `第${weekNumber}周工作评分`
}

function parseSqlTime(raw) {
  if (!raw) return null
  return new Date(raw.replace(' ', 'T') + 'Z')
}

function formatSqlTime(date) {
  return currentSqlTimestamp(date)
}

function getWeekAnchor(now = new Date()) {
  const utc = new Date(now)
  const day = utc.getUTCDay()
  const daysSinceWednesday = (day + 4) % 7
  const anchor = new Date(Date.UTC(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    21,
    10,
    0,
    0
  ))
  anchor.setUTCDate(anchor.getUTCDate() - daysSinceWednesday)

  if (utc.getTime() < anchor.getTime()) {
    anchor.setUTCDate(anchor.getUTCDate() - 7)
  }

  return anchor
}

export function currentSqlTimestamp(now = new Date()) {
  if (typeof now === 'string') {
    return now.replace('T', ' ').slice(0, 19)
  }

  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const hour = String(now.getUTCHours()).padStart(2, '0')
  const minute = String(now.getUTCMinutes()).padStart(2, '0')
  const second = String(now.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

export function safeEnsureCycleColumns() {
  const columns = db.prepare("PRAGMA table_info(rating_cycles)").all().map((row) => row.name)
  const alters = []
  if (!columns.includes('week_number')) alters.push("ALTER TABLE rating_cycles ADD COLUMN week_number INTEGER")
  if (!columns.includes('settle_mode')) alters.push("ALTER TABLE rating_cycles ADD COLUMN settle_mode TEXT DEFAULT 'automatic'")
  if (!columns.includes('public_at')) alters.push("ALTER TABLE rating_cycles ADD COLUMN public_at TEXT")
  if (!columns.includes('is_archived')) alters.push("ALTER TABLE rating_cycles ADD COLUMN is_archived INTEGER DEFAULT 0")
  for (const sql of alters) db.exec(sql)
}

export function seedWeeklyCycles() {
  const count = db.prepare('SELECT COUNT(*) as count FROM rating_cycles').get().count
  if (count > 1) return

  db.prepare('DELETE FROM rating_cycles').run()
  const insert = db.prepare(`INSERT INTO rating_cycles (name, week_number, start_at, end_at, status, public_at, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)

  insert.run(makeWeekName(1), 1, '2026-03-05 21:10:00', '2026-03-07 21:10:00', 'settled', '2026-03-07 21:10:00', 1)
  insert.run(makeWeekName(2), 2, '2026-03-12 21:10:00', '2026-03-14 21:10:00', 'settled', '2026-03-14 21:10:00', 1)
  insert.run(makeWeekName(3), 3, '2026-03-19 21:10:00', '2026-03-21 21:10:00', 'settled', '2026-03-21 21:10:00', 0)
  insert.run(makeWeekName(4), 4, '2026-03-26 21:10:00', '2026-03-28 21:10:00', 'draft', null, 0)
  insert.run(makeWeekName(5), 5, '2026-04-02 21:10:00', '2026-04-04 21:10:00', 'draft', null, 0)
}

export function ensureUpcomingCycle(now = currentSqlTimestamp()) {
  const current = parseSqlTime(now)
  if (!current) return null

  const existing = db.prepare('SELECT * FROM rating_cycles ORDER BY week_number ASC, id ASC').all()
  const maxWeek = existing.reduce((max, cycle) => Math.max(max, Number(cycle.week_number || 0)), 0)

  if (!existing.length) return null

  const anchor = getWeekAnchor(current)
  const targetStarts = [
    new Date(anchor.getTime()),
    new Date(anchor.getTime() + WEEK_MS)
  ]

  const insert = db.prepare(`
    INSERT INTO rating_cycles (name, week_number, start_at, end_at, status, public_at, is_archived, settle_mode)
    VALUES (?, ?, ?, ?, 'draft', NULL, 0, 'automatic')
  `)

  let nextWeekNumber = maxWeek + 1
  let created = null
  for (const start of targetStarts) {
    const startSql = formatSqlTime(start)
    const exists = db.prepare('SELECT * FROM rating_cycles WHERE start_at = ? LIMIT 1').get(startSql)
    if (exists) continue

    const end = new Date(start.getTime() + CYCLE_DURATION_MS)
    insert.run(
      makeWeekName(nextWeekNumber),
      nextWeekNumber,
      startSql,
      formatSqlTime(end)
    )
    created = db.prepare('SELECT * FROM rating_cycles WHERE week_number = ?').get(nextWeekNumber)
    nextWeekNumber += 1
  }

  return created
}

export function normalizeCycleStatuses(now = currentSqlTimestamp()) {
  ensureUpcomingCycle(now)

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE rating_cycles
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'draft'
        AND start_at IS NOT NULL
        AND start_at <= ?
        AND (end_at IS NULL OR end_at > ?)
    `).run(now, now)

    db.prepare(`
      UPDATE rating_cycles
      SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('draft', 'active')
        AND end_at IS NOT NULL
        AND end_at <= ?
    `).run(now)
  })

  tx()
}

export function listCycles() {
  return db.prepare('SELECT * FROM rating_cycles ORDER BY week_number ASC, id ASC').all()
}

export function listCycleHistory() {
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status = 'settled' AND is_archived = 1
    ORDER BY week_number DESC, id DESC
  `).all()
}

export function getCurrentWorkCycle(now = currentSqlTimestamp()) {
  normalizeCycleStatuses(now)
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status IN ('draft', 'active', 'closed')
    ORDER BY week_number ASC, id ASC
    LIMIT 1
  `).get() || null
}

export function getCurrentPublicCycle() {
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status = 'settled' AND public_at IS NOT NULL AND is_archived = 0
    ORDER BY week_number DESC, id DESC
    LIMIT 1
  `).get() || null
}

export function getDisplayCycle(now = currentSqlTimestamp()) {
  const publicCycle = getCurrentPublicCycle()
  const workCycle = getCurrentWorkCycle(now)
  const hasStartedWorkPhase = Boolean(
    workCycle &&
    workCycle.start_at &&
    workCycle.start_at <= now &&
    ['active', 'closed'].includes(workCycle.status)
  )

  if (hasStartedWorkPhase) {
    return workCycle
  }

  if (publicCycle) {
    return publicCycle
  }

  return workCycle
}

export function getUpcomingCycle(now = currentSqlTimestamp()) {
  const workCycle = getCurrentWorkCycle(now)
  if (!workCycle) return null

  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE week_number > ?
    ORDER BY week_number ASC, id ASC
    LIMIT 1
  `).get(workCycle.week_number) || null
}

export function getCurrentCycle(now = currentSqlTimestamp()) {
  return getDisplayCycle(now)
}

export function getCycleById(id) {
  return db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(id)
}

export function archiveOlderPublicCycles(keepCycleId) {
  const cycle = getCycleById(keepCycleId)
  if (!cycle) return

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE rating_cycles
      SET is_archived = CASE WHEN id = ? THEN 0 ELSE 1 END,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'settled' AND public_at IS NOT NULL AND week_number <= ?
    `).run(keepCycleId, cycle.week_number)
  })

  tx()
}

export function getCycleOverview(now = currentSqlTimestamp()) {
  const publicCycle = getCurrentPublicCycle()
  const workCycle = getCurrentWorkCycle(now)
  const upcomingCycle = getUpcomingCycle(now)
  const history = listCycleHistory()

  return {
    publicCycle,
    workCycle,
    displayCycle: getDisplayCycle(now),
    upcomingCycle,
    history
  }
}

export function findAutomaticSettlementCandidates(now = currentSqlTimestamp()) {
  normalizeCycleStatuses(now)
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status IN ('draft', 'active', 'closed')
      AND end_at IS NOT NULL
      AND end_at <= ?
    ORDER BY week_number ASC, id ASC
  `).all(now)
}
