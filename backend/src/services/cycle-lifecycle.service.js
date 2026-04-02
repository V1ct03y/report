import { db } from '../db/client.js'
import { getPersistedSchedulingConfig } from './schedule-config.store.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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

function toISOWeekday(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function getCycleSchedule() {
  return getPersistedSchedulingConfig()
}

function getScheduledOccurrence(reference, targetDay, targetHour, targetMinute) {
  const local = new Date(reference)
  local.setSeconds(0, 0)
  const todayWeekday = toISOWeekday(local)
  const dayOffset = targetDay - todayWeekday

  return new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + dayOffset,
    targetHour,
    targetMinute,
    0,
    0
  )
}

function getCycleDurationMs(config = getCycleSchedule()) {
  const reference = new Date(2026, 0, 5, 12, 0, 0, 0)
  const openAt = getScheduledOccurrence(reference, Number(config.open_day), Number(config.open_hour), Number(config.open_minute))
  const closeAt = getScheduledOccurrence(reference, Number(config.close_day), Number(config.close_hour), Number(config.close_minute))

  if (closeAt.getTime() <= openAt.getTime()) {
    closeAt.setDate(closeAt.getDate() + 7)
  }

  return closeAt.getTime() - openAt.getTime()
}

function getWeekAnchor(now = new Date(), config = getCycleSchedule()) {
  const local = new Date(now)
  const anchor = getScheduledOccurrence(local, Number(config.open_day), Number(config.open_hour), Number(config.open_minute))

  if (local.getTime() < anchor.getTime()) {
    anchor.setDate(anchor.getDate() - 7)
  }

  return anchor
}

function buildCycleWindowFromStart(start, config = getCycleSchedule()) {
  const startAt = new Date(start)
  const endAt = new Date(startAt.getTime() + getCycleDurationMs(config))
  return {
    start_at: formatSqlTime(startAt),
    end_at: formatSqlTime(endAt)
  }
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

function insertPlannedCycle(...params) {
  return db.prepare(`
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
  `).run(...params)
}

function deriveNextPlannedCycle(previousCycle, config = getCycleSchedule()) {
  const nextStart = new Date(parseSqlTime(previousCycle.start_at).getTime() + WEEK_MS)
  return buildCycleWindowFromStart(nextStart, config)
}

function getCurrentOpenSlotStart(now = new Date(), config = getCycleSchedule()) {
  const recentOpen = getWeekAnchor(now, config)
  const windowEnd = new Date(recentOpen.getTime() + getCycleDurationMs(config))
  return now.getTime() < windowEnd.getTime()
    ? recentOpen
    : new Date(recentOpen.getTime() + WEEK_MS)
}

function getNextScheduledOpenAfter(after, config = getCycleSchedule()) {
  const anchor = new Date(after)
  anchor.setSeconds(0, 0)

  const candidate = getScheduledOccurrence(
    anchor,
    Number(config.open_day),
    Number(config.open_hour),
    Number(config.open_minute)
  )

  if (candidate.getTime() <= anchor.getTime()) {
    candidate.setDate(candidate.getDate() + 7)
  }

  return candidate
}

function alignAutomaticDraftCycles(now = currentSqlTimestamp(), config = getCycleSchedule()) {
  const cycles = listCycles()
  if (!cycles.length) return []

  const lockedCycles = cycles
    .filter((cycle) => (
      cycle.settle_mode === 'manual'
      || cycle.status === 'settled'
      || cycle.settled_at
      || cycle.public_at
      || cycle.published_at
      || cycle.archived_at
      || Number(cycle.is_archived) === 1
    ))
    .sort((a, b) => (a.week_number - b.week_number) || (a.id - b.id))

  const lockedWeekNumber = lockedCycles.length
    ? Number(lockedCycles[lockedCycles.length - 1].week_number || 0)
    : 0

  const automaticCycles = cycles
    .filter((cycle) => (
      cycle.settle_mode !== 'manual'
      && ['draft', 'active', 'closed'].includes(cycle.status)
      && !cycle.settled_at
      && !cycle.public_at
      && !cycle.published_at
      && !cycle.archived_at
      && Number(cycle.is_archived) !== 1
      && Number(cycle.week_number || 0) > lockedWeekNumber
    ))
    .sort((a, b) => (a.week_number - b.week_number) || (a.id - b.id))

  if (!automaticCycles.length) return []

  const resolvedNow = typeof now === 'string' ? parseSqlTime(now) : new Date(now)
  const baseWeekNumber = Number(automaticCycles[0].week_number || (lockedWeekNumber + 1))
  const latestLockedCycle = lockedCycles.length ? lockedCycles[lockedCycles.length - 1] : null
  const baseStart = latestLockedCycle
    ? getNextScheduledOpenAfter(
      parseSqlTime(
        latestLockedCycle.published_at
        || latestLockedCycle.public_at
        || latestLockedCycle.end_at
        || latestLockedCycle.settled_at
        || latestLockedCycle.start_at
      ) || resolvedNow,
      config
    )
    : getCurrentOpenSlotStart(resolvedNow, config)

  const updates = []
  const tx = db.transaction(() => {
    for (const cycle of automaticCycles) {
      const offsetWeeks = Number(cycle.week_number || 0) - baseWeekNumber
      const expectedStart = new Date(baseStart.getTime() + offsetWeeks * WEEK_MS)
      const expectedWindow = buildCycleWindowFromStart(expectedStart, config)

      if (cycle.start_at === expectedWindow.start_at && cycle.end_at === expectedWindow.end_at) {
        continue
      }

      db.prepare(`
        UPDATE rating_cycles
        SET start_at = ?,
            end_at = ?,
            status = 'draft',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(expectedWindow.start_at, expectedWindow.end_at, cycle.id)

      updates.push({ ...cycle, ...expectedWindow, status: 'draft' })
    }
  })

  tx()
  return updates.map(withPublicationState)
}

export function seedWeeklyCycles(now = new Date()) {
  const config = getCycleSchedule()
  const count = db.prepare('SELECT COUNT(*) as count FROM rating_cycles').get().count
  if (count > 1) return

  db.prepare('DELETE FROM rating_cycles').run()

  const currentStart = getWeekAnchor(now, config)
  const currentEnd = new Date(currentStart.getTime() + getCycleDurationMs(config))
  const currentStatus = now.getTime() >= currentEnd.getTime() ? 'closed' : 'active'

  const weeks = [
    { weekNumber: 1, start: new Date(currentStart.getTime() - WEEK_MS * 2), status: 'settled', published: true, archived: true, settleMode: 'automatic' },
    { weekNumber: 2, start: new Date(currentStart.getTime() - WEEK_MS), status: 'settled', published: true, archived: true, settleMode: 'automatic' },
    { weekNumber: 3, start: new Date(currentStart.getTime()), status: currentStatus, published: false, archived: false, settleMode: 'automatic' },
    { weekNumber: 4, start: new Date(currentStart.getTime() + WEEK_MS), status: 'draft', published: false, archived: false, settleMode: 'automatic' }
  ]

  for (const week of weeks) {
    const { start_at: startAt, end_at: endAt } = buildCycleWindowFromStart(week.start, config)
    const settledAt = week.status === 'settled' ? endAt : null
    const publishedAt = week.published ? endAt : null
    const archivedAt = week.archived
      ? formatSqlTime(new Date(parseSqlTime(endAt).getTime() + 60 * 60 * 1000))
      : null

    insertPlannedCycle(
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

  ensurePlannedCycleWindow(20, currentSqlTimestamp(now))
}

export function seedProductionCycles(now = new Date()) {
  const config = getCycleSchedule()
  const count = db.prepare('SELECT COUNT(*) as count FROM rating_cycles').get().count
  if (count > 0) return

  const currentStart = getWeekAnchor(now, config)
  const currentEnd = new Date(currentStart.getTime() + getCycleDurationMs(config))
  const currentStatus = now.getTime() >= currentEnd.getTime() ? 'closed' : 'active'

  insertPlannedCycle(
    makeWeekName(1),
    1,
    formatSqlTime(currentStart),
    formatSqlTime(currentEnd),
    currentStatus,
    null,
    null,
    0,
    null,
    null,
    'automatic'
  )

  ensurePlannedCycleWindow(20, currentSqlTimestamp(now))
}

export function ensurePlannedCycleWindow(targetDraftCount = 20, now = currentSqlTimestamp()) {
  const config = getCycleSchedule()
  alignAutomaticDraftCycles(now, config)

  const cycles = listCycles()
  if (!cycles.length) return []

  const futureDrafts = cycles.filter((cycle) => cycle.status === 'draft')
  if (futureDrafts.length >= targetDraftCount) return []

  const created = []
  let anchor = cycles[cycles.length - 1]

  while (futureDrafts.length + created.length < targetDraftCount) {
    const nextWeekNumber = Number(anchor.week_number || 0) + 1
    const nextCycle = deriveNextPlannedCycle(anchor, config)
    insertPlannedCycle(
      makeWeekName(nextWeekNumber),
      nextWeekNumber,
      nextCycle.start_at,
      nextCycle.end_at,
      'draft',
      null,
      null,
      0,
      null,
      null,
      'automatic'
    )
    anchor = db.prepare('SELECT * FROM rating_cycles WHERE week_number = ?').get(nextWeekNumber)
    created.push(anchor)
  }

  return created.map(withPublicationState)
}

export function ensureUpcomingCycle() {
  return ensurePlannedCycleWindow(20)
}

export function reconcileCycleTimeline(now = currentSqlTimestamp()) {
  ensurePlannedCycleWindow(20, now)

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE rating_cycles
      SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('draft', 'active')
        AND end_at IS NOT NULL
        AND end_at <= ?
    `).run(now)

    db.prepare(`
      UPDATE rating_cycles
      SET status = 'draft', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active'
        AND (
          start_at IS NULL
          OR start_at > ?
          OR (end_at IS NOT NULL AND end_at <= ?)
        )
    `).run(now, now)

    const currentCycle = db.prepare(`
      SELECT id
      FROM rating_cycles
      WHERE status IN ('draft', 'active')
        AND start_at IS NOT NULL
        AND start_at <= ?
        AND (end_at IS NULL OR end_at > ?)
      ORDER BY start_at ASC, week_number ASC, id ASC
      LIMIT 1
    `).get(now, now)

    if (currentCycle) {
      db.prepare(`
        UPDATE rating_cycles
        SET status = CASE WHEN id = ? THEN 'active' ELSE 'draft' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('draft', 'active')
          AND start_at IS NOT NULL
          AND start_at <= ?
          AND (end_at IS NULL OR end_at > ?)
      `).run(currentCycle.id, now, now)
    }
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

export function getPendingPublicationCyclePure() {
  return withPublicationState(
    db.prepare(`
      SELECT *
      FROM rating_cycles
      WHERE status = 'settled'
        AND COALESCE(published_at, public_at) IS NULL
        AND archived_at IS NULL
        AND COALESCE(is_archived, 0) = 0
      ORDER BY COALESCE(settled_at, updated_at) DESC, week_number DESC, id DESC
      LIMIT 1
    `).get() || null
  )
}

export function getCurrentWorkCyclePure(now = currentSqlTimestamp()) {
  return withPublicationState(
    db.prepare(`
      SELECT * FROM rating_cycles
      WHERE status IN ('draft', 'active', 'closed')
        AND start_at IS NOT NULL
        AND start_at <= ?
      ORDER BY CASE status
        WHEN 'active' THEN 0
        WHEN 'closed' THEN 1
        ELSE 2
      END ASC,
      week_number DESC,
      id DESC
      LIMIT 1
    `).get(now) || null
  )
}

export function getCurrentWorkCycle(now = currentSqlTimestamp()) {
  normalizeCycleStatuses(now)
  return getCurrentWorkCyclePure(now)
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
  const pendingPublicationCycle = getPendingPublicationCyclePure()
  const publicCycle = getCurrentPublicCyclePure()
  const workCycle = getCurrentWorkCyclePure(now)
  const hasStartedWorkPhase = Boolean(
    workCycle &&
    workCycle.start_at &&
    workCycle.start_at <= now &&
    ['active', 'closed'].includes(workCycle.status)
  )

  if (hasStartedWorkPhase) {
    return workCycle
  }

  if (pendingPublicationCycle) {
    return pendingPublicationCycle
  }

  if (publicCycle) {
    return publicCycle
  }

  return getUpcomingCyclePure(now)
}

export function getDisplayCycle(now = currentSqlTimestamp()) {
  return getDisplayCyclePure(now)
}

export function getUpcomingCyclePure(now = currentSqlTimestamp()) {
  return withPublicationState(
    db.prepare(`
      SELECT * FROM rating_cycles
      WHERE start_at IS NOT NULL
        AND start_at > ?
      ORDER BY week_number ASC, id ASC
      LIMIT 1
    `).get(now) || null
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
  const pendingPublicationCycle = getPendingPublicationCyclePure()
  const publicCycle = getCurrentPublicCyclePure()
  const workCycle = getCurrentWorkCyclePure(now)
  const upcomingCycle = getUpcomingCyclePure(now)
  const history = listCycleHistoryPure()

  return {
    publicCycle,
    pendingPublicationCycle,
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
