import { db } from '../db/client.js'
import {
  ensurePlannedCycleWindow,
  listCycles,
  normalizeLocalDateTimeInput,
  reconcileCycleTimeline
} from './cycle-lifecycle.service.js'

function makeWeekName(weekNumber) {
  return `第${weekNumber}周工作评分`
}

function assertNoCycleOverlap(id, startAt, endAt) {
  if (!startAt || !endAt) return

  const conflict = db.prepare(`
    SELECT id, week_number
    FROM rating_cycles
    WHERE id != ?
      AND start_at IS NOT NULL
      AND end_at IS NOT NULL
      AND NOT (end_at <= ? OR start_at >= ?)
    ORDER BY week_number ASC, id ASC
    LIMIT 1
  `).get(id, startAt, endAt)

  if (conflict) {
    throw new Error(`周期时间与第${conflict.week_number}周冲突`)
  }
}

export function listAllCycles() {
  return listCycles()
}

export function createCycle({ name, start_at, end_at }) {
  const maxWeek = db.prepare('SELECT MAX(week_number) as m FROM rating_cycles').get()?.m || 0
  const resolvedName = name || makeWeekName(maxWeek + 1)
  const normalizedStartAt = normalizeLocalDateTimeInput(start_at)
  const normalizedEndAt = normalizeLocalDateTimeInput(end_at)

  assertNoCycleOverlap(-1, normalizedStartAt, normalizedEndAt)

  const result = db.prepare(`
    INSERT INTO rating_cycles (name, week_number, start_at, end_at, status, public_at, is_archived, settle_mode)
    VALUES (?, ?, ?, ?, 'draft', NULL, 0, 'manual')
  `).run(resolvedName, maxWeek + 1, normalizedStartAt, normalizedEndAt)

  ensurePlannedCycleWindow(20)
  reconcileCycleTimeline()
  return db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(result.lastInsertRowid)
}

export function updateCycle(id, { name, start_at, end_at }) {
  const cycle = db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(id)
  if (!cycle) throw new Error('周期不存在')
  if (cycle.status === 'settled') throw new Error('已结算的周期无法修改')

  const nextStartAt = start_at !== undefined ? normalizeLocalDateTimeInput(start_at) : cycle.start_at
  const nextEndAt = end_at !== undefined ? normalizeLocalDateTimeInput(end_at) : cycle.end_at

  assertNoCycleOverlap(id, nextStartAt, nextEndAt)

  const fields = []
  const values = []
  if (name !== undefined) {
    fields.push('name = ?')
    values.push(name)
  }
  if (start_at !== undefined) {
    fields.push('start_at = ?')
    values.push(nextStartAt)
  }
  if (end_at !== undefined) {
    fields.push('end_at = ?')
    values.push(nextEndAt)
  }
  if (!fields.length) return cycle

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  db.prepare(`UPDATE rating_cycles SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  ensurePlannedCycleWindow(20)
  reconcileCycleTimeline()

  return db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(id)
}

export function deleteCycle(id) {
  const cycle = db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(id)
  if (!cycle) throw new Error('周期不存在')
  if (cycle.status === 'settled') throw new Error('已结算的周期无法删除')
  if (cycle.status === 'active' || cycle.status === 'closed') {
    throw new Error('进行中或已截止的周期无法删除，请先结算后再删除。')
  }

  db.prepare('DELETE FROM rating_cycles WHERE id = ?').run(id)

  ensurePlannedCycleWindow(20)
  reconcileCycleTimeline()

  return { ok: true }
}
