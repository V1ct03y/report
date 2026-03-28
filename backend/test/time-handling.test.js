import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

process.env.DB_PATH = './data/test-time-handling.db'
process.env.TZ = 'Asia/Hong_Kong'

const dbFile = path.resolve(process.cwd(), process.env.DB_PATH)
if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile, { force: true })
}

const { db } = await import('../src/db/client.js')
const { initializeDatabase } = await import('../src/db/bootstrap.js')
initializeDatabase({ mode: 'acceptance' })
const { currentSqlTimestamp, seedWeeklyCycles } = await import('../src/services/cycle-lifecycle.service.js')
const { getSchedulingConfig, getNextScheduledEvents, updateSchedulingConfig } = await import('../src/services/scheduling.service.js')
const { createCycle } = await import('../src/services/cycle-admin.service.js')

function resetCycles() {
  db.prepare('DELETE FROM rating_cycles').run()
  seedWeeklyCycles()
}

function clearSchedulingConfig() {
  db.exec('DROP TABLE IF EXISTS scheduling_config')
}

test('currentSqlTimestamp preserves local wall-clock time', () => {
  const source = new Date('2026-03-25T20:15:30+08:00')
  assert.equal(currentSqlTimestamp(source), '2026-03-25 20:15:30')
})

test('getNextScheduledEvents uses local schedule settings instead of UTC offsets', () => {
  clearSchedulingConfig()
  getSchedulingConfig()
  updateSchedulingConfig({
    enabled: 1,
    open_day: 3,
    open_hour: 20,
    open_minute: 0,
    close_day: 5,
    close_hour: 20,
    close_minute: 0,
    auto_settle: 1
  })

  const { openDate, closeDate } = getNextScheduledEvents(new Date('2026-03-25T19:00:00+08:00'))
  const nextOpen = new Date(openDate)
  const nextClose = new Date(closeDate)

  assert.equal(nextOpen.getFullYear(), 2026)
  assert.equal(nextOpen.getMonth(), 2)
  assert.equal(nextOpen.getDate(), 25)
  assert.equal(nextOpen.getHours(), 20)
  assert.equal(nextOpen.getMinutes(), 0)

  assert.equal(nextClose.getFullYear(), 2026)
  assert.equal(nextClose.getMonth(), 2)
  assert.equal(nextClose.getDate(), 27)
  assert.equal(nextClose.getHours(), 20)
  assert.equal(nextClose.getMinutes(), 0)
})

test('createCycle normalizes datetime-local strings into SQL timestamps', () => {
  resetCycles()
  db.prepare("UPDATE rating_cycles SET status = 'settled', public_at = COALESCE(public_at, end_at), is_archived = 1").run()

  const created = createCycle({
    name: 'Manual test cycle',
    start_at: '2026-09-01T20:00',
    end_at: '2026-09-03T20:00'
  })

  assert.equal(created.start_at, '2026-09-01 20:00:00')
  assert.equal(created.end_at, '2026-09-03 20:00:00')
})
