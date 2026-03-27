import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const view = fs.readFileSync(
  path.resolve('src/views/AdminDashboardView.vue'),
  'utf8'
)

test('admin dashboard removes duplicated results preview and scheduling panels', () => {
  assert.doesNotMatch(view, /自动调度配置/)
  assert.doesNotMatch(view, /结果预览/)
  assert.match(view, /周期列表/)
})

test('cycle row action buttons share a consistent action class', () => {
  assert.match(view, /cycle-action-button/)
  assert.match(view, /cycle-action-button--danger/)
})
