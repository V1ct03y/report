import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'

const backendRoot = process.cwd()

function runInit(dbPath, mode) {
  const resolvedDb = path.resolve(backendRoot, dbPath)
  if (fs.existsSync(resolvedDb)) {
    fs.rmSync(resolvedDb, { force: true })
  }

  const result = spawnSync(
    process.execPath,
    ['src/db/init.js', mode],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        TZ: 'Asia/Hong_Kong',
        DB_PATH: dbPath
      },
      encoding: 'utf8'
    }
  )

  assert.equal(result.status, 0, result.stderr || result.stdout)
  return new Database(resolvedDb)
}

test('production init creates only the bootstrap admin and a week-1 plan window', () => {
  const db = runInit('./data/test-db-init-production.db', 'production')

  const users = db.prepare('SELECT username, role FROM users ORDER BY id ASC').all()
  const cycles = db.prepare('SELECT week_number, status FROM rating_cycles ORDER BY week_number ASC').all()
  const resultCount = db.prepare('SELECT COUNT(*) AS count FROM settlement_results').get().count

  assert.deepEqual(users, [
    { username: 'kwok-admin', role: 'admin' }
  ])
  assert.equal(cycles[0]?.week_number, 1)
  assert.ok(['active', 'closed'].includes(cycles[0]?.status || ''))
  assert.equal(cycles.filter((row) => row.status === 'draft').length, 20)
  assert.equal(cycles.filter((row) => row.week_number < 1).length, 0)
  assert.equal(resultCount, 0)

  db.close()
})

test('acceptance init still creates demo members and archived week 1-2 history', () => {
  const db = runInit('./data/test-db-init-acceptance.db', 'acceptance')

  const users = db.prepare('SELECT username FROM users ORDER BY id ASC').all().map((row) => row.username)
  const archivedWeeks = db.prepare(`
    SELECT week_number
    FROM rating_cycles
    WHERE is_archived = 1
    ORDER BY week_number ASC
  `).all().map((row) => row.week_number)

  assert.ok(users.includes('zhangsan'))
  assert.ok(users.includes('leader-a'))
  assert.deepEqual(archivedWeeks, [1, 2])

  db.close()
})
