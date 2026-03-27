import { db } from '../db/client.js'
import { normalizeCycleStatuses, normalizeLocalDateTimeInput } from './cycle-lifecycle.service.js'
import { updateSchedulingConfig } from './scheduling.service.js'

function makeWeekName(weekNumber) {
  return `第${weekNumber}周工作评分`
}

export function listAllCycles() {
  normalizeCycleStatuses()
  return db.prepare('SELECT * FROM rating_cycles ORDER BY week_number ASC, id ASC').all()
}

export function createCycle({ name, start_at, end_at }) {
  const maxWeek = db.prepare('SELECT MAX(week_number) as m FROM rating_cycles').get()?.m || 0

  const resolvedName = name || makeWeekName(maxWeek + 1)
  const normalizedStartAt = normalizeLocalDateTimeInput(start_at)
  const normalizedEndAt = normalizeLocalDateTimeInput(end_at)

  const existingInProgress = db.prepare(`
    SELECT * FROM rating_cycles WHERE status IN ('draft', 'active', 'closed')
  `).all()
  if (existingInProgress.length) {
    throw new Error('当前已有进行中的周期，请先结算或删除现有周期后再创建新周期。')
  }

  const result = db.prepare(`
    INSERT INTO rating_cycles (name, week_number, start_at, end_at, status, public_at, is_archived, settle_mode)
    VALUES (?, ?, ?, ?, 'draft', NULL, 0, 'manual')
  `).run(resolvedName, maxWeek + 1, normalizedStartAt, normalizedEndAt)

  updateSchedulingConfig({ enabled: 0 })

  return db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(result.lastInsertRowid)
}

export function updateCycle(id, { name, start_at, end_at }) {
  const cycle = db.prepare('SELECT * FROM rating_cycles WHERE id = ?').get(id)
  if (!cycle) throw new Error('周期不存在')
  if (cycle.status === 'settled') throw new Error('已结算的周期无法修改')

  const fields = []
  const values = []
  if (name !== undefined) { fields.push('name = ?'); values.push(name) }
  if (start_at !== undefined) { fields.push('start_at = ?'); values.push(normalizeLocalDateTimeInput(start_at)) }
  if (end_at !== undefined) { fields.push('end_at = ?'); values.push(normalizeLocalDateTimeInput(end_at)) }
  if (!fields.length) return cycle

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  db.prepare(`UPDATE rating_cycles SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  normalizeCycleStatuses(currentSqlTimestamp())

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

  normalizeCycleStatuses(currentSqlTimestamp())

  const remaining = db.prepare('SELECT * FROM rating_cycles WHERE status IN (\'draft\', \'active\', \'closed\')').all()
  if (!remaining.length) {
    updateSchedulingConfig({ enabled: 1 })
  }

  return { ok: true }
}
