import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const dashboardView = fs.readFileSync(
  path.resolve('src/views/AdminDashboardView.vue'),
  'utf8'
)

const controlPanel = fs.readFileSync(
  path.resolve('src/components/admin/CycleControlPanel.vue'),
  'utf8'
)

test('admin dashboard removes duplicated results preview and scheduling panels', () => {
  assert.doesNotMatch(dashboardView, /自动调度配置/)
  assert.doesNotMatch(dashboardView, /结果预览/)
  assert.match(dashboardView, /周期列表/)
  assert.doesNotMatch(dashboardView, /CycleTimelineList/)
})

test('cycle row action buttons share a consistent action class', () => {
  assert.match(dashboardView, /cycle-action-button/)
  assert.match(dashboardView, /cycle-action-button--danger/)
})

test('cycle control panel keeps only current and pending summary cards', () => {
  assert.doesNotMatch(controlPanel, /当前公示周期/)
})

test('admin dashboard includes an inline password-change panel at the bottom', () => {
  assert.match(dashboardView, /修改密码|账户安全/)
  assert.match(dashboardView, /PasswordChangePanel/)
})

test('editing a planned cycle warns before saving past-due times', () => {
  assert.match(dashboardView, /window\.confirm/)
  assert.match(dashboardView, /早于当前时间|立即按当前时间推进状态/)
})
