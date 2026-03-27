import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

process.env.DB_PATH = './data/test-cycle-plan-window.db'
process.env.TZ = 'Asia/Hong_Kong'

const dbFile = path.resolve(process.cwd(), process.env.DB_PATH)
if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile, { force: true })
}

const { db } = await import('../src/db/client.js')
await import('../src/db/init.js')
const { updateCycle, deleteCycle } = await import('../src/services/cycle-admin.service.js')

function countDraftCycles() {
  return db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'draft'").get().count
}

test('fresh init keeps one active cycle plus 20 planned future cycles', () => {
  const weeks = db.prepare(`
    SELECT week_number, status
    FROM rating_cycles
    ORDER BY week_number ASC
  `).all()

  const active = weeks.find((row) => row.status === 'active')
  const drafts = weeks.filter((row) => row.status === 'draft')

  assert.equal(active?.week_number, 3)
  assert.equal(drafts.length, 20)
  assert.equal(drafts[0]?.week_number, 4)
})

test('deleting a future draft cycle refills the 20-cycle window', () => {
  const target = db.prepare(`
    SELECT id
    FROM rating_cycles
    WHERE status = 'draft' AND week_number = 8
  `).get()

  assert.ok(target)

  const before = countDraftCycles()
  deleteCycle(target.id)
  const after = countDraftCycles()

  assert.equal(before, 20)
  assert.equal(after, 20)
})

test('updating a draft cycle rejects overlap with adjacent cycles', () => {
  const target = db.prepare(`
    SELECT id
    FROM rating_cycles
    WHERE week_number = 4
  `).get()

  assert.ok(target)

  assert.throws(
    () => updateCycle(target.id, {
      start_at: '2026-04-07T21:10',
      end_at: '2026-04-10T21:10'
    }),
    /overlap|冲突/i
  )
})
