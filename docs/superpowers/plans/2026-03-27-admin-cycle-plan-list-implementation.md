# Admin Cycle Plan List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scheduler-driven future cycle creation with a 20-cycle plan list, simplify the admin dashboard, and fix the current cycle-management UI issues.

**Architecture:** Keep `rating_cycles` as the single source of truth for all future timing, add a small backend “plan window” layer that keeps 20 future cycles materialized, and shrink the scheduler so it only advances existing cycles through `draft -> active -> closed`. On the frontend, remove duplicated admin surfaces, make the cycle list the primary workspace, and normalize the action affordances and spacing.

**Tech Stack:** Vue 3, Pinia, TypeScript, Express, better-sqlite3, Node test runner, Playwright

---

## File Map

**Backend**

- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\services\cycle-lifecycle.service.js`
  - Add cycle-window seeding and top-up helpers.
  - Stop generating ad hoc future cycles from scheduling rules.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\services\cycle-admin.service.js`
  - Add overlap validation and auto-top-up after delete.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\services\scheduling.service.js`
  - Reduce scheduler to status advancement only.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\db\init.js`
  - Seed a 20-cycle acceptance/demo window.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\routes\admin.routes.js`
  - Stop returning scheduling config to the admin dashboard payload when no longer needed.
- Create: `D:\report\.worktrees\admin-cycle-control-refactor\backend\test\cycle-plan-window.test.js`
  - Cover 20-cycle top-up, deletion refill, and overlap validation.

**Frontend**

- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\views\AdminDashboardView.vue`
  - Remove scheduling section and result preview section.
  - Make the cycle list the primary admin workspace.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\components\admin\CycleControlPanel.vue`
  - Remove the current-public-cycle summary card and fix spacing collisions.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\components\admin\CycleTimelineList.vue`
  - Show current and upcoming context only, or fold into the cycle list if no longer needed.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\stores\app.ts`
  - Remove scheduling reads/writes from dashboard flow and keep cycle-list actions aligned with backend.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\api.ts`
  - Remove or de-emphasize scheduling endpoints from the active admin flow.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\types.ts`
  - Remove stale scheduling-only dashboard assumptions if unused.
- Create: `D:\report\.worktrees\admin-cycle-control-refactor\test\admin-cycle-plan-layout.test.mjs`
  - Lock in removal of duplicated panels and button-size consistency.

**E2E / Docs**

- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\e2e\admin-scheduling.spec.ts`
  - Replace with cycle-plan-window coverage or rename to match new behavior.
- Create: `D:\report\.worktrees\admin-cycle-control-refactor\e2e\admin-cycle-plan-list.spec.ts`
  - Cover future-cycle rendering, edit/delete actions, and auto-top-up.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\playwright.config.ts`
  - Keep `4173` as base URL.
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\AGENTS.md`
  - Update workflow notes once scheduler-config UI is removed.

## Visual Direction

- Visual thesis: make the admin workspace feel like a single planning board instead of a stack of competing cards.
- Content plan: control header, active/pending snapshot, cycle list workspace, account management.
- Interaction thesis:
  - the cycle list is the dominant workspace
  - action buttons align on one baseline and share one visual size
  - compact status chips, no duplicated “preview” surfaces

### Task 1: Lock In The New Behavior With Failing Tests

**Files:**
- Create: `D:\report\.worktrees\admin-cycle-control-refactor\backend\test\cycle-plan-window.test.js`
- Create: `D:\report\.worktrees\admin-cycle-control-refactor\test\admin-cycle-plan-layout.test.mjs`

- [ ] **Step 1: Write the failing backend test for 20-cycle top-up**

```js
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
```

- [ ] **Step 2: Write the failing backend test for delete-and-refill**

```js
test('deleting a future draft cycle refills the 20-cycle window', () => {
  const before = db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'draft'").get().count
  deleteCycle(8)
  const after = db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'draft'").get().count

  assert.equal(before, 20)
  assert.equal(after, 20)
})
```

- [ ] **Step 3: Write the failing backend test for overlap validation**

```js
test('updating a draft cycle rejects overlap with adjacent cycles', () => {
  assert.throws(
    () => updateCycle(4, {
      start_at: '2026-04-07T21:10',
      end_at: '2026-04-10T21:10'
    }),
    /overlap|冲突/i
  )
})
```

- [ ] **Step 4: Write the failing frontend layout test**

```js
test('admin dashboard removes duplicated results preview and scheduling panels', () => {
  const view = fs.readFileSync(path.resolve('src/views/AdminDashboardView.vue'), 'utf8')
  assert.doesNotMatch(view, /自动调度配置/)
  assert.doesNotMatch(view, /结果预览/)
  assert.match(view, /周期列表/)
})

test('cycle row action buttons share a consistent action class', () => {
  const view = fs.readFileSync(path.resolve('src/views/AdminDashboardView.vue'), 'utf8')
  assert.match(view, /cycle-action-button/)
  assert.match(view, /cycle-action-button--danger/)
})
```

- [ ] **Step 5: Run the new tests to verify they fail**

Run:

```powershell
npm --prefix backend test
node --test test/admin-cycle-plan-layout.test.mjs
```

Expected:

- backend suite fails because the future window is still shorter than 20 and delete does not refill
- frontend layout test fails because the old scheduling and preview sections still exist

- [ ] **Step 6: Commit the failing-test scaffold**

```powershell
git add backend/test/cycle-plan-window.test.js test/admin-cycle-plan-layout.test.mjs
git commit -m "test: cover cycle plan window behavior"
```

### Task 2: Materialize A 20-Cycle Window In The Backend

**Files:**
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\services\cycle-lifecycle.service.js`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\db\init.js`
- Test: `D:\report\.worktrees\admin-cycle-control-refactor\backend\test\cycle-plan-window.test.js`

- [ ] **Step 1: Add a helper that derives the default next cycle**

```js
function deriveNextPlannedCycle(previousCycle) {
  const nextStart = new Date(parseSqlTime(previousCycle.start_at).getTime() + WEEK_MS)
  const nextEnd = new Date(nextStart.getTime() + CYCLE_DURATION_MS)

  return {
    start_at: formatSqlTime(nextStart),
    end_at: formatSqlTime(nextEnd)
  }
}
```

- [ ] **Step 2: Add a helper that tops up draft cycles to a 20-cycle future window**

```js
export function ensurePlannedCycleWindow(targetDraftCount = 20) {
  const cycles = listCycles()
  const futureDrafts = cycles.filter((cycle) => cycle.status === 'draft')
  if (futureDrafts.length >= targetDraftCount) return []

  const created = []
  let anchor = cycles[cycles.length - 1]

  while (futureDrafts.length + created.length < targetDraftCount) {
    const next = deriveNextPlannedCycle(anchor)
    const weekNumber = Number(anchor.week_number) + 1
    insertCycle.run(makeWeekName(weekNumber), weekNumber, next.start_at, next.end_at)
    anchor = db.prepare('SELECT * FROM rating_cycles WHERE week_number = ?').get(weekNumber)
    created.push(anchor)
  }

  return created
}
```

- [ ] **Step 3: Call the top-up helper from `seedWeeklyCycles()` and `reconcileCycleTimeline()`**

```js
export function seedWeeklyCycles(now = new Date()) {
  // keep weeks 1-3 acceptance setup
  // create week 4 as the first future draft
  // then call ensurePlannedCycleWindow(20)
}

export function reconcileCycleTimeline(now = currentSqlTimestamp()) {
  ensurePlannedCycleWindow(20)
  // existing draft->active and active->closed transitions stay here
}
```

- [ ] **Step 4: Extend `db:init` acceptance data so the demo state still starts at week 3 active**

```js
seedWeeklyCycles()
if (cycleCount <= 1) {
  seedAcceptanceHistoryData()
}
ensurePlannedCycleWindow(20)
```

- [ ] **Step 5: Run backend tests and verify green**

Run:

```powershell
npm --prefix backend test
```

Expected:

- `cycle-plan-window.test.js` passes
- prior acceptance seed tests still pass

- [ ] **Step 6: Commit the backend window materialization**

```powershell
git add backend/src/services/cycle-lifecycle.service.js backend/src/db/init.js backend/test/cycle-plan-window.test.js
git commit -m "feat: materialize 20-cycle plan window"
```

### Task 3: Remove Scheduler-Owned Future Generation And Add Safer Cycle Editing

**Files:**
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\services\scheduling.service.js`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\services\cycle-admin.service.js`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\backend\src\routes\admin.routes.js`
- Test: `D:\report\.worktrees\admin-cycle-control-refactor\backend\test\cycle-plan-window.test.js`

- [ ] **Step 1: Remove future-cycle creation from the scheduler**

```js
export function startScheduler() {
  if (schedulerTask) return
  schedulerTask = cron.schedule('* * * * *', () => {
    reconcileCycleTimeline(currentSqlTimestamp())
    // no autoOpenCycle call here
    // no scheduling-config-based cycle generation here
  })
}
```

- [ ] **Step 2: Add overlap validation for draft cycle edits**

```js
function assertNoCycleOverlap(id, startAt, endAt) {
  const conflict = db.prepare(`
    SELECT id, week_number
    FROM rating_cycles
    WHERE id != ?
      AND start_at IS NOT NULL
      AND end_at IS NOT NULL
      AND NOT (end_at <= ? OR start_at >= ?)
    ORDER BY week_number ASC
    LIMIT 1
  `).get(id, startAt, endAt)

  if (conflict) {
    throw new Error(`周期时间与第${conflict.week_number}周冲突`)
  }
}
```

- [ ] **Step 3: Refill the future window after draft deletion**

```js
export function deleteCycle(id) {
  // existing draft-only guard
  db.prepare('DELETE FROM rating_cycles WHERE id = ?').run(id)
  ensurePlannedCycleWindow(20)
  return { ok: true }
}
```

- [ ] **Step 4: Stop loading scheduling data in the admin dashboard route**

```js
res.json({
  cycle: workCycle,
  publicCycle,
  overview: getCycleOverviewPure(),
  cycleControl: getAdminCycleControl(),
  // remove scheduling payload from dashboard contract
})
```

- [ ] **Step 5: Run targeted backend tests**

Run:

```powershell
node --test backend/test/cycle-plan-window.test.js
npm --prefix backend test
```

Expected:

- delete refill and overlap tests pass
- no regressions in existing admin cycle-control tests

- [ ] **Step 6: Commit the scheduler simplification**

```powershell
git add backend/src/services/scheduling.service.js backend/src/services/cycle-admin.service.js backend/src/routes/admin.routes.js backend/test/cycle-plan-window.test.js
git commit -m "refactor: drive future cycles from plan list"
```

### Task 4: Simplify The Admin Dashboard Surface

**Files:**
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\views\AdminDashboardView.vue`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\components\admin\CycleControlPanel.vue`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\components\admin\CycleTimelineList.vue`
- Test: `D:\report\.worktrees\admin-cycle-control-refactor\test\admin-cycle-plan-layout.test.mjs`

- [ ] **Step 1: Remove the scheduling section and result-preview section from the admin dashboard template**

```vue
<TableSection title="周期控制中心" description="...">
  <CycleControlPanel ... />
</TableSection>

<TableSection title="周期列表" description="未来20周计划、当前周与已完成周统一在这里维护。">
  <!-- list workspace -->
</TableSection>

<TableSection title="账号管理" description="...">
  <!-- existing account management -->
</TableSection>
```

- [ ] **Step 2: Remove the “当前公示周期” summary card from `CycleControlPanel.vue`**

```vue
<div class="control-panel__grid">
  <article class="surface-card summary-card">
    <span class="summary-card__label">当前工作周期</span>
    ...
  </article>

  <article class="surface-card summary-card">
    <span class="summary-card__label">待公示周期</span>
    ...
  </article>
</div>
```

- [ ] **Step 3: Increase spacing and prevent chip/button collisions**

```css
.control-panel__hero {
  align-items: flex-start;
  gap: 1.25rem;
}

.control-panel__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.summary-card {
  min-width: 0;
  align-content: start;
}
```

- [ ] **Step 4: Make `CycleTimelineList.vue` either two-item-only or remove it if redundant**

```vue
<article v-if="control.currentCycle" class="timeline-item surface-card">...</article>
<article v-if="control.upcomingCycle" class="timeline-item surface-card">...</article>
```

- [ ] **Step 5: Run the frontend layout test**

Run:

```powershell
node --test test/admin-cycle-plan-layout.test.mjs
```

Expected:

- no match for `自动调度配置`
- no match for `结果预览`
- no third public-cycle summary card remains

- [ ] **Step 6: Commit the admin-surface cleanup**

```powershell
git add src/views/AdminDashboardView.vue src/components/admin/CycleControlPanel.vue src/components/admin/CycleTimelineList.vue test/admin-cycle-plan-layout.test.mjs
git commit -m "refactor: simplify admin cycle dashboard"
```

### Task 5: Turn The Cycle List Into The Main Workspace

**Files:**
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\views\AdminDashboardView.vue`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\stores\app.ts`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\api.ts`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\src\types.ts`
- Test: `D:\report\.worktrees\admin-cycle-control-refactor\test\admin-cycle-plan-layout.test.mjs`

- [ ] **Step 1: Remove scheduling reads/writes from the dashboard mount flow**

```ts
onMounted(() => {
  appStore.loadDashboard().catch(() => undefined)
  appStore.loadPublicResults().catch(() => undefined)
  appStore.loadAdminCycleControl().catch(() => undefined)
  appStore.loadAllCycles().catch(() => undefined)
})
```

- [ ] **Step 2: Normalize cycle-row action buttons**

```vue
<button class="secondary-button cycle-action-button" type="button">调整时间</button>
<button class="secondary-button cycle-action-button cycle-action-button--danger" type="button">删除</button>
```

```css
.cycle-action-button {
  min-width: 8.5rem;
  min-height: 3rem;
  padding: 0.85rem 1.15rem;
}

.cycle-action-button--danger {
  color: #c76442;
  border-color: rgba(214, 129, 98, 0.55);
}
```

- [ ] **Step 3: Render actions by phase instead of only for drafts**

```vue
<button v-if="cycle.status === 'draft'" class="secondary-button cycle-action-button">调整时间</button>
<button v-if="cycle.status === 'draft'" class="secondary-button cycle-action-button cycle-action-button--danger">删除</button>
<button v-if="cycle.status === 'active'" class="primary-button cycle-action-button">提前结算</button>
<button v-if="cycle.status === 'closed'" class="primary-button cycle-action-button">立即结算</button>
<button v-if="cycle.status === 'settled' && !cycle.published_at" class="primary-button cycle-action-button">公示</button>
<button v-if="cycle.published_at && !cycle.archived_at" class="secondary-button cycle-action-button">归档</button>
```

- [ ] **Step 4: Keep the top “create cycle” affordance only if it still serves manual insertion**

```vue
<div class="cycle-create">
  <button class="secondary-button" type="button" @click="toggleCreateForm">插入临时周期</button>
</div>
```

If it adds noise after the 20-cycle window is visible, remove it entirely from this phase.

- [ ] **Step 5: Run frontend verification**

Run:

```powershell
node --test test/admin-cycle-plan-layout.test.mjs
npm run build
```

Expected:

- layout test passes
- build passes with no TypeScript errors

- [ ] **Step 6: Commit the cycle-list workspace changes**

```powershell
git add src/views/AdminDashboardView.vue src/stores/app.ts src/api.ts src/types.ts test/admin-cycle-plan-layout.test.mjs
git commit -m "feat: make cycle list the admin workspace"
```

### Task 6: Replace Scheduler E2E Coverage With Cycle-Plan Coverage

**Files:**
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\e2e\admin-scheduling.spec.ts`
- Create: `D:\report\.worktrees\admin-cycle-control-refactor\e2e\admin-cycle-plan-list.spec.ts`
- Modify: `D:\report\.worktrees\admin-cycle-control-refactor\AGENTS.md`

- [ ] **Step 1: Replace the old scheduling-focused E2E with plan-list assertions**

```ts
test('admin sees a continuous future cycle window', async ({ page }) => {
  await login(page, 'kwok-admin', 'ChangeMe123!')
  await page.goto('/admin')
  await expect(page.getByText('周期列表')).toBeVisible()
  await expect(page.getByText('第4周工作评分')).toBeVisible()
  await expect(page.getByText('第20周工作评分')).toBeVisible()
})
```

- [ ] **Step 2: Add E2E coverage for editing and deleting a future cycle**

```ts
test('editing and deleting a future draft cycle preserves the window', async ({ page }) => {
  await login(page, 'kwok-admin', 'ChangeMe123!')
  await page.goto('/admin')
  await page.getByRole('button', { name: '调整时间' }).nth(0).click()
  await page.locator('input[type="datetime-local"]').nth(0).fill('2026-04-01T22:00')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('04/01 22:00')).toBeVisible()
})
```

- [ ] **Step 3: Update `AGENTS.md` so future agents no longer trust scheduling config as the main workflow**

```md
- Cycle timing is driven by `rating_cycles`, not the old scheduler configuration UI.
- When changing cycle automation, verify the 20-cycle plan window and status advancement rules.
```

- [ ] **Step 4: Run E2E verification**

Run:

```powershell
npx playwright test e2e/admin-cycle-plan-list.spec.ts
```

Expected:

- the spec reaches the admin dashboard on port `4173`
- future-cycle planning and edit/delete actions pass

- [ ] **Step 5: Run full final verification**

Run:

```powershell
npm --prefix backend test
node --test test/admin-cycle-plan-layout.test.mjs
node --test test/reset-password-layout.test.mjs
npm run build
npx playwright test e2e/admin-cycle-plan-list.spec.ts
```

Expected:

- all commands exit `0`

- [ ] **Step 6: Commit the verification and docs cleanup**

```powershell
git add e2e/admin-scheduling.spec.ts e2e/admin-cycle-plan-list.spec.ts AGENTS.md
git commit -m "test: cover admin cycle plan list workflow"
```

## Self-Review

- Spec coverage: this plan covers UI cleanup, removal of duplicate panels, cycle-list actions, 20-cycle materialization, scheduler simplification, overlap validation, and updated verification.
- Placeholder scan: there are no `TODO` or `TBD` markers; each task names concrete files and commands.
- Type consistency: the plan uses existing `rating_cycles`, `published_at`, and `archived_at` terminology consistently with the current refactor branch.
