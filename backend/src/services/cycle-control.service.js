import { db } from '../db/client.js'
import {
  currentSqlTimestamp,
  getCycleById,
  getCycleOverviewPure,
  reconcileCycleTimeline
} from './cycle-lifecycle.service.js'

function deriveAdminPhase(cycle, now = currentSqlTimestamp()) {
  if (!cycle) return null
  if (cycle.archived_at) return 'archived'
  if (cycle.published_at) return 'published'
  if (cycle.status === 'settled') return 'settled'
  if (cycle.end_at && cycle.end_at <= now) return 'closed'
  if (cycle.start_at && cycle.start_at <= now) return 'open'
  return 'planned'
}

function toAdminCycle(cycle, now = currentSqlTimestamp()) {
  if (!cycle) return null
  return {
    ...cycle,
    phase: deriveAdminPhase(cycle, now),
    isPublished: Boolean(cycle.published_at),
    isArchived: Boolean(cycle.archived_at)
  }
}

export function getAdminCycleControl(now = currentSqlTimestamp()) {
  const overview = getCycleOverviewPure(now)
  const pendingPublicationCycle = db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status = 'settled'
      AND COALESCE(published_at, public_at) IS NULL
      AND archived_at IS NULL
      AND COALESCE(is_archived, 0) = 0
    ORDER BY settled_at DESC, week_number DESC, id DESC
    LIMIT 1
  `).get()

  return {
    currentCycle: toAdminCycle(overview.workCycle, now),
    upcomingCycle: toAdminCycle(overview.upcomingCycle, now),
    publishedCycle: toAdminCycle(overview.publicCycle, now),
    pendingPublicationCycle: toAdminCycle(
      pendingPublicationCycle ? getCycleById(pendingPublicationCycle.id) : null,
      now
    ),
    displayCycle: toAdminCycle(overview.displayCycle, now),
    history: overview.history.map((cycle) => toAdminCycle(cycle, now))
  }
}

export function getAdminResultsCycle() {
  const settled = db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status = 'settled'
      AND archived_at IS NULL
      AND COALESCE(is_archived, 0) = 0
    ORDER BY COALESCE(published_at, settled_at, updated_at) DESC, week_number DESC, id DESC
    LIMIT 1
  `).get()

  return settled ? getCycleById(settled.id) : null
}

export function publishCycle(cycleId, publishedAt = currentSqlTimestamp()) {
  const cycle = getCycleById(cycleId)
  if (!cycle) {
    throw new Error('周期不存在')
  }
  if (cycle.status !== 'settled') {
    throw new Error('只有已结算周期可以公示')
  }

  db.prepare(`
    UPDATE rating_cycles
    SET published_at = ?,
        public_at = ?,
        archived_at = NULL,
        is_archived = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(publishedAt, publishedAt, cycleId)

  return getCycleById(cycleId)
}

export function archiveCycle(cycleId, archivedAt = currentSqlTimestamp()) {
  const cycle = getCycleById(cycleId)
  if (!cycle) {
    throw new Error('周期不存在')
  }
  if (!cycle.published_at) {
    throw new Error('只有已公示周期可以归档')
  }

  db.prepare(`
    UPDATE rating_cycles
    SET archived_at = ?,
        is_archived = 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(archivedAt, cycleId)

  return getCycleById(cycleId)
}

export { reconcileCycleTimeline }
