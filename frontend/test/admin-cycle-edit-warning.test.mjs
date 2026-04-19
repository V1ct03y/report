import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

function readAdminDashboard() {
  const root = process.cwd()
  const candidates = [
    path.join(root, 'frontend/src/views/AdminDashboardView.vue'),
    path.join(root, 'src/views/AdminDashboardView.vue')
  ]

  const filePath = candidates.find((candidate) => fs.existsSync(candidate))
  assert.ok(filePath, 'Could not find AdminDashboardView.vue from current working directory')
  return fs.readFileSync(filePath, 'utf8')
}

test('cycle edit confirmation only considers fields that were actually changed', () => {
  const content = readAdminDashboard()

  assert.doesNotMatch(content, /\[candidateStart,\s*candidateEnd\]\.some/)
  assert.match(content, /editForm\.start_at !== originalStart/)
  assert.match(content, /editForm\.end_at !== originalEnd/)
})
