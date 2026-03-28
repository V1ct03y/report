import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

process.env.DB_PATH = './data/test-cycle-control.db'
process.env.TZ = 'Asia/Hong_Kong'

const dbFile = path.resolve(process.cwd(), process.env.DB_PATH)
if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile, { force: true })
}

const { db } = await import('../src/db/client.js')
const { initializeDatabase } = await import('../src/db/bootstrap.js')
initializeDatabase({ mode: 'acceptance' })
const { seedWeeklyCycles, getCycleOverviewPure } = await import('../src/services/cycle-lifecycle.service.js')
const {
  getAdminCycleControl,
  publishCycle,
  archiveCycle,
  reconcileCycleTimeline
} = await import('../src/services/cycle-control.service.js')
const { settleCycle } = await import('../src/services/settlement.service.js')

function resetCycleState() {
  db.prepare('DELETE FROM settlement_results').run()
  db.prepare('DELETE FROM employee_scores').run()
  db.prepare('DELETE FROM employee_score_submissions').run()
  db.prepare('DELETE FROM manager_scores').run()
  db.prepare('DELETE FROM cycle_participants').run()
  db.prepare('DELETE FROM rating_cycles').run()
  seedWeeklyCycles()
}

test('getAdminCycleControl does not create or settle cycles', () => {
  resetCycleState()

  const beforeCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count
  const beforeSettled = db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'settled'").get().count

  const payload = getAdminCycleControl('2026-03-27 09:00:00')

  const afterCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count
  const afterSettled = db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'settled'").get().count

  assert.ok(payload.currentCycle || payload.upcomingCycle || payload.publishedCycle)
  assert.equal(afterCount, beforeCount)
  assert.equal(afterSettled, beforeSettled)
})

test('getCycleOverviewPure does not insert future cycles', () => {
  resetCycleState()

  const beforeCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count

  getCycleOverviewPure('2026-03-27 09:00:00')

  const afterCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count
  assert.equal(afterCount, beforeCount)
})

test('publishCycle marks one cycle as published without settling another cycle', () => {
  resetCycleState()

  const settled = db.prepare("SELECT id FROM rating_cycles WHERE status = 'settled' ORDER BY week_number DESC LIMIT 1").get()
  assert.ok(settled)

  publishCycle(settled.id, '2026-03-27 10:00:00')

  const row = db.prepare('SELECT published_at, archived_at FROM rating_cycles WHERE id = ?').get(settled.id)
  assert.equal(row.published_at, '2026-03-27 10:00:00')
  assert.equal(row.archived_at, null)
})

test('archiveCycle archives only the requested published cycle', () => {
  resetCycleState()

  const settled = db.prepare("SELECT id FROM rating_cycles WHERE status = 'settled' ORDER BY week_number DESC LIMIT 1").get()
  assert.ok(settled)

  publishCycle(settled.id, '2026-03-27 10:00:00')
  archiveCycle(settled.id, '2026-03-27 11:00:00')

  const row = db.prepare('SELECT archived_at FROM rating_cycles WHERE id = ?').get(settled.id)
  assert.equal(row.archived_at, '2026-03-27 11:00:00')
})

test('settleCycle leaves publication empty until publish is called', () => {
  resetCycleState()

  const draft = db.prepare("SELECT * FROM rating_cycles WHERE status = 'draft' ORDER BY week_number ASC LIMIT 1").get()
  assert.ok(draft)

  db.prepare(`
    UPDATE rating_cycles
    SET status = 'closed',
        public_at = NULL,
        published_at = NULL,
        archived_at = NULL,
        is_archived = 0
    WHERE id = ?
  `).run(draft.id)

  settleCycle(draft.id, 'manual', '2026-03-29 10:00:00')

  const row = db.prepare('SELECT status, settled_at, public_at, published_at FROM rating_cycles WHERE id = ?').get(draft.id)
  assert.equal(row.status, 'settled')
  assert.equal(row.settled_at, '2026-03-29 10:00:00')
  assert.equal(row.public_at, null)
  assert.equal(row.published_at, null)
})

test('reconcileCycleTimeline performs transitions only when called explicitly', () => {
  resetCycleState()

  const draft = db.prepare("SELECT id FROM rating_cycles WHERE status = 'draft' ORDER BY week_number ASC LIMIT 1").get()
  assert.ok(draft)

  reconcileCycleTimeline('2099-01-01 00:00:00')

  const row = db.prepare('SELECT status FROM rating_cycles WHERE id = ?').get(draft.id)
  assert.equal(row.status, 'closed')
})
