import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readView() {
  const candidates = [
    path.join(root, 'frontend/src/views/AdminDashboardView.vue'),
    path.join(root, 'src/views/AdminDashboardView.vue')
  ]

  const resolved = candidates.find((filePath) => fs.existsSync(filePath))
  assert.ok(resolved, 'Could not find AdminDashboardView.vue from current working directory')
  return fs.readFileSync(resolved, 'utf8')
}

test('admin dashboard derives current work cycle summary from admin cycle control state', () => {
  const content = readView()

  assert.match(content, /adminCurrentWorkLabel/)
  assert.match(content, /adminCurrentPeriodText/)
  assert.match(content, /adminStageLabel/)
  assert.match(content, /adminStageDeadline/)
  assert.doesNotMatch(content, /<strong class="kpi-item__value">{{ cycleSummary\.workLabel }}/)
  assert.doesNotMatch(content, /<p class="kpi-item__detail">{{ cycleSummary\.currentPeriodText }}/)
  assert.doesNotMatch(content, /<strong>{{ cycleSummary\.stageLabel }}/)
  assert.doesNotMatch(content, /<p>{{ cycleSummary\.deadlineExact }}/)
})
