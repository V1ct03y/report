import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

process.env.DB_PATH = './data/test-cycle-reconcile-single-active.db'
process.env.TZ = 'Asia/Hong_Kong'

const dbFile = path.resolve(process.cwd(), process.env.DB_PATH)
if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile, { force: true })
}

const { db } = await import('../src/db/client.js')
const { initializeDatabase } = await import('../src/db/bootstrap.js')
initializeDatabase({ mode: 'acceptance' })
const { reconcileCycleTimeline } = await import('../src/services/cycle-lifecycle.service.js')

test('reconcileCycleTimeline keeps only the earliest overlapping cycle active', () => {
  db.prepare('DELETE FROM rating_cycles').run()

  db.prepare(`
    INSERT INTO rating_cycles (name, week_number, start_at, end_at, status, settle_mode)
    VALUES
      ('第3周工作评分', 3, '2026-03-26 21:10:00', '2026-03-28 21:10:00', 'draft', 'automatic'),
      ('第4周工作评分', 4, '2026-03-27 09:00:00', '2026-03-29 21:10:00', 'draft', 'automatic')
  `).run()

  reconcileCycleTimeline('2026-03-27 10:00:00')

  const rows = db.prepare(`
    SELECT week_number, status
    FROM rating_cycles
    ORDER BY week_number ASC
  `).all()

  const active = rows.filter((row) => row.status === 'active')
  assert.deepEqual(active, [{ week_number: 3, status: 'active' }])
  assert.equal(rows.find((row) => row.week_number === 4)?.status, 'draft')
})
