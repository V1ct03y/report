import { db } from '../db/client.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CYCLE_DURATION_MS = 2 * 24 * 60 * 60 * 1000

function makeWeekName(weekNumber) {
  return `\u7b2c${weekNumber}\u5468\u5de5\u4f5c\u8bc4\u5206`
}

function parseSqlTime(raw) {
  if (!raw) return null
  return new Date(raw.replace(' ', 'T'))
}

function formatSqlTime(date) {
  return currentSqlTimestamp(date)
}

function getPublishedAt(cycle) {
  return cycle?.published_at ?? cycle?.public_at ?? null
}

function getArchivedAt(cycle) {
  if (!cycle) return null
  if (cycle.archived_at) return cycle.archived_at
  return Number(cycle.is_archived) === 1 ? (cycle.updated_at ?? null) : null
}

function withPublicationState(cycle) {
  if (!cycle) return null
  return {
    ...cycle,
    published_at: getPublishedAt(cycle),
    archived_at: getArchivedAt(cycle)
  }
}

export function normalizeLocalDateTimeInput(raw) {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!value) return null
  const normalized = value.replace('T', ' ')
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`
  }
  return normalized.slice(0, 19)
}

function getWeekAnchor(now = new Date()) {
  const local = new Date(now)
  const day = local.getDay()
  const daysSinceWednesday = (day + 4) % 7
  const anchor = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    21,
    10,
    0,
    0
  )
  anchor.setDate(anchor.getDate() - daysSinceWednesday)

  if (local.getTime() < anchor.getTime()) {
    anchor.setDate(anchor.getDate() - 7)
  }

  return anchor
}

export function currentSqlTimestamp(now = new Date()) {
  if (typeof now === 'string') {
    return normalizeLocalDateTimeInput(now)
  }

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

export function safeEnsureCycleColumns() {
  const columns = db.prepare("PRAGMA table_info(rating_cycles)").all().map((row) => row.name)
  const alters = []
  if (!columns.includes('week_number')) alters.push("ALTER TABLE rating_cycles ADD COLUMN week_number INTEGER")
  if (!columns.includes('settle_mode')) alters.push("ALTER TABLE rating_cycles ADD COLUMN settle_mode TEXT DEFAULT 'automatic'")
  if (!columns.includes('public_at')) alters.push("ALTER TABLE rating_cycles ADD COLUMN public_at TEXT")
  if (!columns.includes('is_archived')) alters.push("ALTER TABLE rating_cycles ADD COLUMN is_archived INTEGER DEFAULT 0")
  if (!columns.includes('published_at')) alters.push("ALTER TABLE rating_cycles ADD COLUMN published_at TEXT")
  if (!columns.includes('archived_at')) alters.push("ALTER TABLE rating_cycles ADD COLUMN archived_at TEXT")
  for (const sql of alters) db.exec(sql)

  db.exec(`
    UPDATE rating_cycles
    SET published_at = COALESCE(published_at, public_at),
        archived_at = CASE
          WHEN archived_at IS NOT NULL THEN archived_at
          WHEN is_archived = 1 THEN updated_at
          ELSE NULL
        END
  `)
}

export function seedWeeklyCycles(now = new Date()) {
  const count = db.prepare('SELECT COUNT(*) as count FROM rating_cycles').get().count
  if (count > 1) return

  db.prepare('DELETE FROM rating_cycles').run()

  const currentStart = getWeekAnchor(now)
  const currentEnd = new Date(currentStart.getTime() + CYCLE_DURATION_MS)
  const currentStatus = now.getTime() >= currentEnd.getTime() ? 'closed' : 'active'
  const insert = db.prepare(`
    INSERT INTO rating_cycles (
      name,
      week_number,
      start_at,
      end_at,
      status,
      settled_at,
      public_at,
      is_archived,
      published_at,
      archived_at,
      settle_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const weeks = [
    { weekNumber: 1, start: new Date(currentStart.getTime() - WEEK_MS * 2), status: 'settled', published: true, archived: true, settleMode: 'automatic' },
    { weekNumber: 2, start: new Date(currentStart.getTime() - WEEK_MS), status: 'settled', published: true, archived: true, settleMode: 'automatic' },
    { weekNumber: 3, start: new Date(currentStart.getTime()), status: currentStatus, published: false, archived: false, settleMode: 'automatic' },
    { weekNumber: 4, start: new Date(currentStart.getTime() + WEEK_MS), status: 'draft', published: false, archived: false, settleMode: 'automatic' }
  ]

  for (const week of weeks) {
    const startAt = formatSqlTime(week.start)
    const endAt = formatSqlTime(new Date(week.start.getTime() + CYCLE_DURATION_MS))
    const settledAt = week.status === 'settled' ? endAt : null
    const publishedAt = week.published ? endAt : null
    const archivedAt = week.archived
      ? formatSqlTime(new Date(week.start.getTime() + CYCLE_DURATION_MS + 60 * 60 * 1000))
      : null

    insert.run(
      makeWeekName(week.weekNumber),
      week.weekNumber,
      startAt,
      endAt,
      week.status,
      settledAt,
      publishedAt,
      week.archived ? 1 : 0,
      publishedAt,
      archivedAt,
      week.settleMode
    )
  }
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

export function reconcileCycleTimeline(now = currentSqlTimestamp()) {
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

export function normalizeCycleStatuses(now = currentSqlTimestamp()) {
  reconcileCycleTimeline(now)
}

export function listCycles() {
  return db.prepare('SELECT * FROM rating_cycles ORDER BY week_number ASC, id ASC').all()
}

export function listCycleHistoryPure() {
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status = 'settled'
      AND (archived_at IS NOT NULL OR is_archived = 1)
    ORDER BY week_number DESC, id DESC
  `).all().map(withPublicationState)
}

export function listCycleHistory() {
  return listCycleHistoryPure()
}

export function getCurrentWorkCyclePure() {
  return withPublicationState(
    db.prepare(`
      SELECT * FROM rating_cycles
      WHERE status IN ('draft', 'active', 'closed')
      ORDER BY week_number ASC, id ASC
      LIMIT 1
    `).get() || null
  )
}

export function getCurrentWorkCycle(now = currentSqlTimestamp()) {
  normalizeCycleStatuses(now)
  return getCurrentWorkCyclePure()
}

export function getCurrentPublicCyclePure() {
  return withPublicationState(
    db.prepare(`
      SELECT * FROM rating_cycles
      WHERE status = 'settled'
        AND COALESCE(published_at, public_at) IS NOT NULL
        AND archived_at IS NULL
        AND COALESCE(is_archived, 0) = 0
      ORDER BY week_number DESC, id DESC
      LIMIT 1
    `).get() || null
  )
}

export function getCurrentPublicCycle() {
  return getCurrentPublicCyclePure()
}

export function getDisplayCyclePure(now = currentSqlTimestamp()) {
  const publicCycle = getCurrentPublicCyclePure()
  const workCycle = getCurrentWorkCyclePure()
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

export function getDisplayCycle(now = currentSqlTimestamp()) {
  return getDisplayCyclePure(now)
}

export function getUpcomingCyclePure(now = currentSqlTimestamp()) {
  const workCycle = getCurrentWorkCyclePure()
  if (!workCycle) return null

  return withPublicationState(
    db.prepare(`
      SELECT * FROM rating_cycles
      WHERE week_number > ?
      ORDER BY week_number ASC, id ASC
      LIMIT 1
    `).get(workCycle.week_number) || null
  )
}

export function getUpcomingCycle(now = currentSqlTimestamp()) {
  normalizeCycleStatuses(now)
  return getUpcomingCyclePure(now)
}

export function getCurrentCycle(now = currentSqlTimestamp()) {
  return getDisplayCycle(now)
}

export function getCycleById(id) {
  return withPublicationState(db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(id) || null)
}

export function archiveOlderPublicCycles(keepCycleId) {
  const cycle = getCycleById(keepCycleId)
  if (!cycle) return
  const archivedAt = currentSqlTimestamp()

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE rating_cycles
      SET is_archived = CASE WHEN id = ? THEN 0 ELSE 1 END,
          archived_at = CASE WHEN id = ? THEN NULL ELSE COALESCE(archived_at, ?) END,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'settled'
        AND COALESCE(published_at, public_at) IS NOT NULL
        AND week_number <= ?
    `).run(keepCycleId, keepCycleId, archivedAt, cycle.week_number)
  })

  tx()
}

export function getCycleOverviewPure(now = currentSqlTimestamp()) {
  const publicCycle = getCurrentPublicCyclePure()
  const workCycle = getCurrentWorkCyclePure()
  const upcomingCycle = getUpcomingCyclePure(now)
  const history = listCycleHistoryPure()

  return {
    publicCycle,
    workCycle,
    displayCycle: getDisplayCyclePure(now),
    upcomingCycle,
    history
  }
}

export function getCycleOverview(now = currentSqlTimestamp()) {
  normalizeCycleStatuses(now)
  return getCycleOverviewPure(now)
}

export function findAutomaticSettlementCandidates(now = currentSqlTimestamp()) {
  reconcileCycleTimeline(now)
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status IN ('draft', 'active', 'closed')
      AND end_at IS NOT NULL
      AND end_at <= ?
    ORDER BY week_number ASC, id ASC
  `).all(now)
}
