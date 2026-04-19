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
const {
  currentSqlTimestamp,
  seedWeeklyCycles,
  ensurePlannedCycleWindow,
  reconcileCycleTimeline
} = await import('../src/services/cycle-lifecycle.service.js')
const { getSchedulingConfig, getNextScheduledEvents, updateSchedulingConfig } = await import('../src/services/scheduling.service.js')
const { createCycle, updateCycle } = await import('../src/services/cycle-admin.service.js')

function resetCycles(now = new Date('2026-03-27T12:00:00+08:00')) {
  db.prepare('DELETE FROM rating_cycles').run()
  seedWeeklyCycles(now)
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

test('seedWeeklyCycles derives cycle windows from scheduling_config', () => {
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

  resetCycles(new Date('2026-03-27T12:00:00+08:00'))

  const rows = db.prepare(`
    SELECT week_number, start_at, end_at, status
    FROM rating_cycles
    WHERE week_number IN (3, 4)
    ORDER BY week_number ASC
  `).all()

  assert.deepEqual(rows, [
    {
      week_number: 3,
      start_at: '2026-03-25 20:00:00',
      end_at: '2026-03-27 20:00:00',
      status: 'active'
    },
    {
      week_number: 4,
      start_at: '2026-04-01 20:00:00',
      end_at: '2026-04-03 20:00:00',
      status: 'draft'
    }
  ])
})

test('automatic draft cycles realign to the configured schedule before reconciliation', () => {
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

  db.prepare('DELETE FROM rating_cycles').run()
  db.prepare(`
    INSERT INTO rating_cycles (
      name, week_number, start_at, end_at, status, settled_at, public_at, published_at, is_archived, archived_at, settle_mode
    )
    VALUES
      ('第3周工作评分', 3, '2026-03-26 21:10:00', '2026-03-29 21:10:00', 'settled', '2026-03-29 13:20:47', '2026-03-29 13:27:58', '2026-03-29 13:27:58', 0, NULL, 'manual'),
      ('第4周工作评分', 4, '2026-04-02 21:10:00', '2026-04-04 21:10:00', 'draft', NULL, NULL, NULL, 0, NULL, 'automatic'),
      ('第5周工作评分', 5, '2026-04-09 21:10:00', '2026-04-11 21:10:00', 'draft', NULL, NULL, NULL, 0, NULL, 'automatic')
  `).run()

  ensurePlannedCycleWindow(2, '2026-04-02 10:30:00')
  reconcileCycleTimeline('2026-04-02 10:30:00')

  const rows = db.prepare(`
    SELECT week_number, start_at, end_at, status
    FROM rating_cycles
    WHERE week_number IN (4, 5)
    ORDER BY week_number ASC
  `).all()

  assert.deepEqual(rows, [
    {
      week_number: 4,
      start_at: '2026-04-01 20:00:00',
      end_at: '2026-04-03 20:00:00',
      status: 'active'
    },
    {
      week_number: 5,
      start_at: '2026-04-08 20:00:00',
      end_at: '2026-04-10 20:00:00',
      status: 'draft'
    }
  ])
})

test('manually extending the current cycle keeps its custom end time after reconciliation', () => {
  clearSchedulingConfig()
  getSchedulingConfig()
  updateSchedulingConfig({
    enabled: 1,
    open_day: 3,
    open_hour: 21,
    open_minute: 30,
    close_day: 7,
    close_hour: 21,
    close_minute: 30,
    auto_settle: 1
  })

  db.prepare('DELETE FROM rating_cycles').run()
  db.prepare(`
    INSERT INTO rating_cycles (
      name, week_number, start_at, end_at, status, settled_at, public_at, published_at, is_archived, archived_at, settle_mode
    )
    VALUES
      ('第4周工作评分', 4, '2026-04-01 21:30:00', '2026-04-06 21:30:00', 'settled', '2026-04-07 12:05:15', '2026-04-07 12:05:20', '2026-04-07 12:05:20', 1, '2026-04-10 00:28:31', 'manual'),
      ('第5周工作评分', 5, '2026-04-08 21:30:00', '2026-04-10 21:30:00', 'active', NULL, NULL, NULL, 0, NULL, 'automatic'),
      ('第6周工作评分', 6, '2026-04-15 21:30:00', '2026-04-17 21:30:00', 'draft', NULL, NULL, NULL, 0, NULL, 'automatic')
  `).run()

  const week5 = db.prepare('SELECT id FROM rating_cycles WHERE week_number = 5').get()
  assert.ok(week5)

  updateCycle(week5.id, { end_at: '2026-04-12T21:30' }, '2026-04-10 21:40:00')
  reconcileCycleTimeline('2026-04-10 21:40:00')

  const week5After = db.prepare(`
    SELECT week_number, end_at, status, settle_mode
    FROM rating_cycles
    WHERE week_number = 5
  `).get()

  assert.deepEqual(week5After, {
    week_number: 5,
    end_at: '2026-04-12 21:30:00',
    status: 'active',
    settle_mode: 'manual'
  })
})

test('manually extending a closed cycle reopens it when the new end time is in the future', () => {
  clearSchedulingConfig()
  getSchedulingConfig()
  updateSchedulingConfig({
    enabled: 1,
    open_day: 3,
    open_hour: 21,
    open_minute: 30,
    close_day: 7,
    close_hour: 21,
    close_minute: 30,
    auto_settle: 1
  })

  db.prepare('DELETE FROM rating_cycles').run()
  db.prepare(`
    INSERT INTO rating_cycles (
      name, week_number, start_at, end_at, status, settled_at, public_at, published_at, is_archived, archived_at, settle_mode
    )
    VALUES
      ('第4周工作评分', 4, '2026-04-01 21:30:00', '2026-04-06 21:30:00', 'settled', '2026-04-07 12:05:15', '2026-04-07 12:05:20', '2026-04-07 12:05:20', 1, '2026-04-10 00:28:31', 'manual'),
      ('第5周工作评分', 5, '2026-04-08 21:30:00', '2026-04-10 21:30:00', 'closed', NULL, NULL, NULL, 0, NULL, 'automatic'),
      ('第6周工作评分', 6, '2026-04-15 21:30:00', '2026-04-17 21:30:00', 'draft', NULL, NULL, NULL, 0, NULL, 'automatic')
  `).run()

  const week5 = db.prepare('SELECT id FROM rating_cycles WHERE week_number = 5').get()
  assert.ok(week5)

  const updated = updateCycle(week5.id, { end_at: '2026-04-12T21:30' }, '2026-04-10 21:40:00')

  assert.equal(updated.end_at, '2026-04-12 21:30:00')
  assert.equal(updated.status, 'active')
  assert.equal(updated.settle_mode, 'manual')
})
