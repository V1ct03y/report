import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

process.env.DB_PATH = './data/test-acceptance-seed.db'
process.env.TZ = 'Asia/Hong_Kong'

const dbFile = path.resolve(process.cwd(), process.env.DB_PATH)
if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile, { force: true })
}

const { db } = await import('../src/db/client.js')
await import('../src/db/init.js')
const {
  getCycleOverviewPure,
  listCycleHistoryPure,
  reconcileCycleTimeline
} = await import('../src/services/cycle-lifecycle.service.js')
const { getPublicResults } = await import('../src/services/settlement.service.js')

test('fresh init seeds two archived history weeks and one current unsettled week', () => {
  const overview = getCycleOverviewPure('2026-03-27 12:00:00')
  assert.equal(overview.publicCycle, null)
  assert.equal(overview.workCycle?.week_number, 3)
  assert.ok(['active', 'closed'].includes(overview.workCycle?.status || ''))
  assert.equal(overview.upcomingCycle?.week_number, 4)

  const historyWeeks = listCycleHistoryPure().map((cycle) => cycle.week_number)
  assert.deepEqual(historyWeeks, [2, 1])
})

test('fresh init seeds historical ranking and anonymous matrix data for week 1 and week 2', () => {
  for (const cycleId of [1, 2]) {
    const payload = getPublicResults(cycleId)
    assert.equal(payload.employees.length, 4)
    assert.equal(payload.matrix.length, 4)
    assert.equal(payload.ranking.length, 4)
    assert.ok(payload.ranking.every((item) => item.rankPosition > 0))
  }
})

test('reconcile keeps the acceptance timeline at four weeks instead of creating extra demo weeks', () => {
  reconcileCycleTimeline('2026-03-27 12:00:00')

  const weeks = db.prepare('SELECT week_number, status FROM rating_cycles ORDER BY week_number ASC').all()
  assert.deepEqual(
    weeks.map((row) => row.week_number),
    [1, 2, 3, 4]
  )
})
