import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const view = fs.readFileSync(
  path.resolve('src/views/AdminDashboardView.vue'),
  'utf8'
)

const controlPanel = fs.readFileSync(
  path.resolve('src/components/admin/CycleControlPanel.vue'),
  'utf8'
)

test('admin dashboard removes duplicated results preview and scheduling panels', () => {
  assert.doesNotMatch(view, /自动调度配置/)
  assert.doesNotMatch(view, /结果预览/)
  assert.match(view, /周期列表/)
  assert.doesNotMatch(view, /CycleTimelineList/)
})

test('cycle row action buttons share a consistent action class', () => {
  assert.match(view, /cycle-action-button/)
  assert.match(view, /cycle-action-button--danger/)
})

test('cycle control panel keeps only current and pending summary cards', () => {
  assert.doesNotMatch(controlPanel, /当前公示周期/)
})
