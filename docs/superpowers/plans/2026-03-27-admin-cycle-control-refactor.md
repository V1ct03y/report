# Admin Cycle Control Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current side-effect-heavy cycle flow with an explicit admin-controlled cycle control model that separates reads from writes, separates settlement from publication, and makes the admin UI predictable.

**Architecture:** Keep the existing Vue 3 + Express + SQLite stack, but split cycle behavior into pure query helpers, explicit command helpers, and a small admin-facing control DTO. Persisted cycle rows can keep the existing `draft | active | closed | settled` status, while admin-facing phase labels are derived from timestamps and flags. The admin dashboard becomes a focused control center backed by explicit endpoints for open, close, settle, publish, and archive.

**Tech Stack:** Vue 3, Pinia, Vue Router, Express, better-sqlite3, node-cron, Playwright, Node built-in `node:test`

---

## File Structure

**Create**
- `backend/test/cycle-control.service.test.js` - backend regression tests for pure reads, explicit commands, and publish/archive behavior
- `backend/src/services/cycle-control.service.js` - admin-facing read model and explicit cycle command helpers
- `src/components/admin/CycleControlPanel.vue` - focused current-cycle control surface for admins
- `src/components/admin/CycleTimelineList.vue` - cycle list split into current, upcoming, history sections

**Modify**
- `backend/package.json` - add backend test script
- `backend/src/db/init.js` - add compatibility migration for publication/archive timestamps
- `backend/src/services/cycle-lifecycle.service.js` - make read helpers side-effect free and add explicit reconcile helpers
- `backend/src/services/scheduling.service.js` - scheduler should call explicit commands instead of relying on read paths
- `backend/src/services/settlement.service.js` - settlement stops auto-publishing and only computes settled results
- `backend/src/services/cycle-admin.service.js` - cycle CRUD stops disabling scheduling implicitly and uses explicit validation helpers
- `backend/src/routes/admin.routes.js` - add cycle-control read endpoint and explicit action endpoints
- `backend/src/routes/employee.routes.js` - remove route-level auto-settlement side effects
- `backend/src/routes/cycle.routes.js` - remove route-level auto-settlement side effects and return explicit publication state
- `src/api.ts` - add cycle control endpoints and replace overloaded settle/public calls
- `src/types.ts` - add admin cycle control DTOs and replace ambiguous public/archive fields
- `src/stores/app.ts` - consume cycle control DTO, stop deriving admin flow from `displayCycle`
- `src/views/AdminDashboardView.vue` - replace mixed control area with dedicated cycle control components
- `src/views/ResultsPublicView.vue` - consume explicit `isPublished` and `publishedCycle` semantics
- `e2e/admin-scheduling.spec.ts` - update admin cycle tests for explicit actions
- `e2e/full-rating-flow.spec.ts` - update end-to-end flow to include settle then publish

**No changes expected**
- Member scoring form structure in `src/views/EmployeeRatingView.vue`
- Leader scoring form structure in `src/views/SupervisorScoringView.vue`

## Implementation Notes

- Preserve the existing SQLite table and status values where possible to reduce migration risk.
- Introduce `published_at` and `archived_at` columns, while keeping `public_at` and `is_archived` readable during migration for backward compatibility.
- The scheduler may still auto-open/auto-close cycles, but only through explicit command helpers, never through read endpoints or page loads.
- The admin UI should expose one “next action” for the current cycle instead of forcing the user to infer it from multiple sections.

### Task 1: Add cycle-control backend tests and migration guardrails

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/db/init.js`
- Test: `backend/test/cycle-control.service.test.js`

- [ ] **Step 1: Write the failing backend tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { db } from '../src/db/client.js'
import '../src/db/init.js'
import {
  getAdminCycleControl,
  reconcileCycleTimeline,
  publishCycle,
  archiveCycle
} from '../src/services/cycle-control.service.js'

test('getAdminCycleControl does not create or settle cycles', () => {
  const beforeCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count
  const beforeSettled = db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'settled'").get().count

  const payload = getAdminCycleControl()

  const afterCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count
  const afterSettled = db.prepare("SELECT COUNT(*) AS count FROM rating_cycles WHERE status = 'settled'").get().count

  assert.ok(payload.currentCycle || payload.upcomingCycle || payload.publishedCycle)
  assert.equal(afterCount, beforeCount)
  assert.equal(afterSettled, beforeSettled)
})

test('publishCycle marks one cycle as published without settling another cycle', () => {
  const settled = db.prepare("SELECT id FROM rating_cycles WHERE status = 'settled' ORDER BY week_number DESC LIMIT 1").get()
  assert.ok(settled)

  publishCycle(settled.id, '2026-03-27 10:00:00')

  const row = db.prepare('SELECT published_at, archived_at FROM rating_cycles WHERE id = ?').get(settled.id)
  assert.equal(row.published_at, '2026-03-27 10:00:00')
  assert.equal(row.archived_at, null)
})

test('archiveCycle archives only the requested published cycle', () => {
  const settled = db.prepare("SELECT id FROM rating_cycles WHERE status = 'settled' ORDER BY week_number DESC LIMIT 1").get()
  assert.ok(settled)

  publishCycle(settled.id, '2026-03-27 10:00:00')
  archiveCycle(settled.id, '2026-03-27 11:00:00')

  const row = db.prepare('SELECT archived_at FROM rating_cycles WHERE id = ?').get(settled.id)
  assert.equal(row.archived_at, '2026-03-27 11:00:00')
})

test('reconcileCycleTimeline performs transitions only when called explicitly', () => {
  const draft = db.prepare("SELECT id FROM rating_cycles WHERE status = 'draft' ORDER BY week_number ASC LIMIT 1").get()
  assert.ok(draft)

  reconcileCycleTimeline('2099-01-01 00:00:00')

  const row = db.prepare('SELECT status FROM rating_cycles WHERE id = ?').get(draft.id)
  assert.equal(row.status, 'closed')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: FAIL with messages like `Cannot find module '../src/services/cycle-control.service.js'` and `no such column: published_at`

- [ ] **Step 3: Add backend test script and compatibility migration**

```json
{
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "db:init": "node src/db/init.js",
    "test": "node --test"
  }
}
```

```js
function ensureCyclePublicationColumns() {
  const columns = db.prepare("PRAGMA table_info(rating_cycles)").all().map((row) => row.name)
  const alters = []
  if (!columns.includes('published_at')) alters.push("ALTER TABLE rating_cycles ADD COLUMN published_at TEXT")
  if (!columns.includes('archived_at')) alters.push("ALTER TABLE rating_cycles ADD COLUMN archived_at TEXT")
  for (const sql of alters) db.exec(sql)

  db.exec(`
    UPDATE rating_cycles
    SET published_at = COALESCE(published_at, public_at),
        archived_at = CASE
          WHEN archived_at IS NOT NULL THEN archived_at
          WHEN is_archived = 1 THEN updated_at
          ELSE NULL
        END
  `)
}

db.exec(schema)
ensureUserRoleModel()
safeEnsureCycleColumns()
ensureCyclePublicationColumns()
```

- [ ] **Step 4: Run tests to verify migration wiring still fails only on missing service behavior**

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: FAIL with `Cannot find module '../src/services/cycle-control.service.js'`

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/src/db/init.js backend/test/cycle-control.service.test.js
git commit -m "test: add cycle control regression scaffolding"
```

### Task 2: Make cycle reads pure and add explicit reconcile helpers

**Files:**
- Create: `backend/src/services/cycle-control.service.js`
- Modify: `backend/src/services/cycle-lifecycle.service.js`
- Test: `backend/test/cycle-control.service.test.js`

- [ ] **Step 1: Extend tests to prove read helpers are side-effect free**

```js
test('listCycleOverviewPure does not insert future cycles', () => {
  const beforeCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count

  const { getCycleOverviewPure } = await import('../src/services/cycle-lifecycle.service.js')
  getCycleOverviewPure('2026-03-27 09:00:00')

  const afterCount = db.prepare('SELECT COUNT(*) AS count FROM rating_cycles').get().count
  assert.equal(afterCount, beforeCount)
})
```

- [ ] **Step 2: Run the focused backend test**

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: FAIL with `getCycleOverviewPure is not a function`

- [ ] **Step 3: Implement pure read helpers and explicit reconcile command**

```js
export function ensureUpcomingCycle(now = currentSqlTimestamp()) {
  const current = parseSqlTime(now)
  if (!current) return null
  // keep existing insert logic
}

export function reconcileCycleTimeline(now = currentSqlTimestamp()) {
  ensureUpcomingCycle(now)

  db.prepare(`
    UPDATE rating_cycles
    SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'draft'
      AND start_at IS NOT NULL
      AND start_at <= ?
      AND (end_at IS NULL OR end_at > ?)
  `).run(now, now)

  db.prepare(`
    UPDATE rating_cycles
    SET status = 'closed', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('draft', 'active')
      AND end_at IS NOT NULL
      AND end_at <= ?
  `).run(now)
}

export function getCurrentWorkCyclePure(now = currentSqlTimestamp()) {
  return db.prepare(`
    SELECT * FROM rating_cycles
    WHERE status IN ('draft', 'active', 'closed')
    ORDER BY week_number ASC, id ASC
    LIMIT 1
  `).get() || null
}

export function getCycleOverviewPure(now = currentSqlTimestamp()) {
  const publishedCycle = getCurrentPublishedCyclePure()
  const currentCycle = getCurrentWorkCyclePure(now)
  const upcomingCycle = getUpcomingCyclePure(now)
  return { publishedCycle, currentCycle, upcomingCycle, history: listCycleHistoryPure() }
}
```

```js
import {
  reconcileCycleTimeline,
  getCycleOverviewPure,
  getCurrentWorkCyclePure,
  getCurrentPublishedCyclePure
} from './cycle-lifecycle.service.js'

export function getAdminCycleControl(now = currentSqlTimestamp()) {
  const overview = getCycleOverviewPure(now)
  return {
    ...overview,
    currentCycle: overview.currentCycle,
    nextAction: deriveNextAction(overview.currentCycle),
    scheduler: null
  }
}
```

- [ ] **Step 4: Run backend tests to verify pure-read behavior now passes**

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: PASS for the pure-read assertion, FAIL for publish/archive assertions

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cycle-lifecycle.service.js backend/src/services/cycle-control.service.js backend/test/cycle-control.service.test.js
git commit -m "refactor: separate cycle reads from reconcile commands"
```

### Task 3: Separate settle, publish, and archive commands in backend routes

**Files:**
- Modify: `backend/src/services/settlement.service.js`
- Modify: `backend/src/services/cycle-control.service.js`
- Modify: `backend/src/routes/admin.routes.js`
- Modify: `backend/src/routes/employee.routes.js`
- Modify: `backend/src/routes/cycle.routes.js`
- Test: `backend/test/cycle-control.service.test.js`

- [ ] **Step 1: Add failing tests for explicit command flow**

```js
test('settleCycle writes settled_at but does not publish automatically', () => {
  const closable = db.prepare("SELECT id FROM rating_cycles WHERE status IN ('closed', 'settled') ORDER BY week_number ASC LIMIT 1").get()
  assert.ok(closable)

  const { settleCycle } = await import('../src/services/settlement.service.js')
  settleCycle(closable.id, 'manual', '2026-03-27 12:00:00')

  const row = db.prepare('SELECT settled_at, published_at FROM rating_cycles WHERE id = ?').get(closable.id)
  assert.equal(row.settled_at, '2026-03-27 12:00:00')
  assert.equal(row.published_at, null)
})
```

- [ ] **Step 2: Run tests to verify current settle behavior fails**

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: FAIL because `published_at` is set during settlement

- [ ] **Step 3: Implement explicit backend commands and routes**

```js
export function settleCycle(cycleId, settleMode = 'manual', settledAt = currentSqlTimestamp()) {
  const cycle = getCycleById(cycleId)
  // keep score calculation logic
  db.prepare(`
    UPDATE rating_cycles
    SET status = 'settled',
        settled_at = ?,
        settle_mode = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(settledAt, settleMode, cycleId)

  return getPublicResults(cycleId)
}

export function publishCycle(cycleId, publishedAt = currentSqlTimestamp()) {
  db.prepare(`
    UPDATE rating_cycles
    SET published_at = ?, archived_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'settled'
  `).run(publishedAt, cycleId)
}

export function archiveCycle(cycleId, archivedAt = currentSqlTimestamp()) {
  db.prepare(`
    UPDATE rating_cycles
    SET archived_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(archivedAt, cycleId)
}
```

```js
adminRouter.get('/cycle-control', requireRole('admin'), (_req, res) => {
  res.json(getAdminCycleControl())
})

adminRouter.post('/cycles/:id/open', requireRole('admin'), (req, res) => {
  res.json({ cycle: openCycle(Number(req.params.id)) })
})

adminRouter.post('/cycles/:id/close', requireRole('admin'), (req, res) => {
  res.json({ cycle: closeCycle(Number(req.params.id)) })
})

adminRouter.post('/cycles/:id/settle', requireRole('admin'), (req, res) => {
  res.json({ results: settleCycle(Number(req.params.id), 'manual') })
})

adminRouter.post('/cycles/:id/publish', requireRole('admin'), (req, res) => {
  publishCycle(Number(req.params.id))
  res.json({ ok: true })
})

adminRouter.post('/cycles/:id/archive', requireRole('admin'), (req, res) => {
  archiveCycle(Number(req.params.id))
  res.json({ ok: true })
})
```

```js
// Remove this from read routers:
// router.use((_req, _res, next) => { settlePendingCycles(); next() })
```

- [ ] **Step 4: Run backend tests to verify explicit command flow passes**

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: PASS for settle/publish/archive assertions

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/settlement.service.js backend/src/services/cycle-control.service.js backend/src/routes/admin.routes.js backend/src/routes/employee.routes.js backend/src/routes/cycle.routes.js backend/test/cycle-control.service.test.js
git commit -m "feat: add explicit admin cycle commands"
```

### Task 4: Refactor frontend types, API, and store around admin cycle control

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`
- Modify: `src/stores/app.ts`

- [ ] **Step 1: Write the failing type contract in the store**

```ts
export interface AdminCycleAction {
  key: 'open' | 'close' | 'settle' | 'publish' | 'archive' | 'none'
  label: string
  destructive?: boolean
}

export interface AdminCycleControl {
  currentCycle: CycleRecord | null
  upcomingCycle: CycleRecord | null
  publishedCycle: CycleRecord | null
  history: CycleRecord[]
  nextAction: AdminCycleAction
}
```

```ts
const adminCycleControl = ref<AdminCycleControl | null>(null)
```

- [ ] **Step 2: Run the frontend build to verify missing members break compilation**

Run: `npm run build`

Expected: FAIL with TypeScript errors such as `Property 'adminCycleControl' does not exist`

- [ ] **Step 3: Implement new API/store flow**

```ts
export const api = {
  getAdminCycleControl() {
    return request('/admin/cycle-control')
  },
  openCycle(id: number) {
    return request(`/admin/cycles/${id}/open`, { method: 'POST' })
  },
  closeCycle(id: number) {
    return request(`/admin/cycles/${id}/close`, { method: 'POST' })
  },
  settleCycle(id: number) {
    return request(`/admin/cycles/${id}/settle`, { method: 'POST' })
  },
  publishCycle(id: number) {
    return request(`/admin/cycles/${id}/publish`, { method: 'POST' })
  },
  archiveCycle(id: number) {
    return request(`/admin/cycles/${id}/archive`, { method: 'POST' })
  }
}
```

```ts
async function loadAdminCycleControl() {
  adminCycleControl.value = await api.getAdminCycleControl()
}

async function runAdminCycleAction(action: AdminCycleAction['key'], cycleId: number) {
  if (action === 'open') await api.openCycle(cycleId)
  if (action === 'close') await api.closeCycle(cycleId)
  if (action === 'settle') await api.settleCycle(cycleId)
  if (action === 'publish') await api.publishCycle(cycleId)
  if (action === 'archive') await api.archiveCycle(cycleId)
  await loadAdminCycleControl()
  await loadDashboard()
  await loadPublicResults().catch(() => undefined)
}
```

- [ ] **Step 4: Run the frontend build to verify the new data contract compiles**

Run: `npm run build`

Expected: PASS or fail only in `AdminDashboardView.vue` because UI still references the old model

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/api.ts src/stores/app.ts
git commit -m "refactor: introduce admin cycle control client model"
```

### Task 5: Rebuild the admin cycle area into a focused control center

**Files:**
- Create: `src/components/admin/CycleControlPanel.vue`
- Create: `src/components/admin/CycleTimelineList.vue`
- Modify: `src/views/AdminDashboardView.vue`

- [ ] **Step 1: Write the failing component integration in the dashboard**

```vue
<script setup lang="ts">
import CycleControlPanel from '../components/admin/CycleControlPanel.vue'
import CycleTimelineList from '../components/admin/CycleTimelineList.vue'
</script>

<template>
  <CycleControlPanel
    :control="adminCycleControl"
    @run-action="handleCycleAction"
  />
  <CycleTimelineList
    :current-cycle="adminCycleControl?.currentCycle ?? null"
    :upcoming-cycle="adminCycleControl?.upcomingCycle ?? null"
    :published-cycle="adminCycleControl?.publishedCycle ?? null"
    :history="adminCycleControl?.history ?? []"
  />
</template>
```

- [ ] **Step 2: Run the frontend build to verify missing components break compilation**

Run: `npm run build`

Expected: FAIL with `Cannot find module '../components/admin/CycleControlPanel.vue'`

- [ ] **Step 3: Implement the new admin control components**

```vue
<!-- src/components/admin/CycleControlPanel.vue -->
<script setup lang="ts">
import type { AdminCycleAction, AdminCycleControl } from '../../types'

defineProps<{
  control: AdminCycleControl | null
}>()

const emit = defineEmits<{
  (e: 'run-action', action: AdminCycleAction['key'], cycleId: number): void
}>()
</script>

<template>
  <section class="surface-card cycle-control-panel">
    <p class="cycle-control-panel__eyebrow">Current cycle</p>
    <h3>{{ control?.currentCycle?.name ?? 'No current cycle' }}</h3>
    <p>{{ control?.nextAction.label ?? 'No action available' }}</p>
    <button
      v-if="control?.currentCycle && control.nextAction.key !== 'none'"
      class="primary-button"
      type="button"
      @click="emit('run-action', control.nextAction.key, control.currentCycle.id)"
    >
      {{ control.nextAction.label }}
    </button>
  </section>
</template>
```

```vue
<!-- src/components/admin/CycleTimelineList.vue -->
<script setup lang="ts">
import type { CycleRecord } from '../../types'

defineProps<{
  currentCycle: CycleRecord | null
  upcomingCycle: CycleRecord | null
  publishedCycle: CycleRecord | null
  history: CycleRecord[]
}>()
</script>

<template>
  <section class="surface-card cycle-timeline-list">
    <h3>Cycle timeline</h3>
    <ul>
      <li v-if="currentCycle">Current: {{ currentCycle.name }}</li>
      <li v-if="upcomingCycle">Upcoming: {{ upcomingCycle.name }}</li>
      <li v-if="publishedCycle">Published: {{ publishedCycle.name }}</li>
      <li v-for="cycle in history" :key="cycle.id">Archived: {{ cycle.name }}</li>
    </ul>
  </section>
</template>
```

- [ ] **Step 4: Run the frontend build to verify the dashboard compiles**

Run: `npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CycleControlPanel.vue src/components/admin/CycleTimelineList.vue src/views/AdminDashboardView.vue
git commit -m "feat: simplify admin cycle control UI"
```

### Task 6: Update public/member flow semantics and end-to-end coverage

**Files:**
- Modify: `src/views/ResultsPublicView.vue`
- Modify: `e2e/admin-scheduling.spec.ts`
- Modify: `e2e/full-rating-flow.spec.ts`

- [ ] **Step 1: Write the failing end-to-end expectations**

```ts
test('admin must publish after settling before member sees unmasked results', async ({ browser }) => {
  const adminPage = await browser.newPage()
  const memberPage = await browser.newPage()

  await login(adminPage, 'kwok-admin', 'ChangeMe123!')
  await login(memberPage, 'zhangsan', 'ChangeMe123!')

  await adminPage.getByRole('button', { name: /结算/i }).click()
  await memberPage.goto('/public/results')

  await expect(memberPage.locator('.masked-surface__veil')).toBeVisible()

  await adminPage.getByRole('button', { name: /公示/i }).click()
  await memberPage.reload()

  await expect(memberPage.locator('.masked-surface__veil')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the targeted Playwright specs to verify they fail**

Run: `npx playwright test e2e/admin-scheduling.spec.ts e2e/full-rating-flow.spec.ts`

Expected: FAIL because settlement still reveals results immediately and the admin dashboard still exposes old controls

- [ ] **Step 3: Update public-view logic and e2e scripts**

```ts
const shouldMask = computed(() => !cycleSummary.value.isPublicVisible && !isPrivileged.value)
const publicationState = computed(() => {
  if (cycleSummary.value.isPublicVisible) return 'Published'
  return 'Awaiting publication'
})
```

```ts
test('cycle control panel shows next action', async ({ page }) => {
  await loginAsAdmin(page)
  await expect(page.getByText(/Current cycle/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /结算|公示|开启|关闭/i })).toBeVisible()
})
```

- [ ] **Step 4: Run verification**

Run: `npm run build`

Expected: PASS

Run: `npm --prefix backend test -- cycle-control.service.test.js`

Expected: PASS

Run: `npx playwright test e2e/admin-scheduling.spec.ts e2e/full-rating-flow.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/ResultsPublicView.vue e2e/admin-scheduling.spec.ts e2e/full-rating-flow.spec.ts
git commit -m "test: cover explicit settle and publish flow"
```

## Self-Review

- Spec coverage: This plan covers the two core requirements from the discussion: remove hidden side effects from cycle reads, and rebuild the admin experience around explicit cycle actions. It also covers the necessary supporting work in types, routes, store, UI, and regression tests.
- Placeholder scan: No `TODO`, `TBD`, or “appropriate handling” placeholders remain. Each task contains concrete files, code, commands, and expected outcomes.
- Type consistency: The plan uses one consistent admin DTO family: `AdminCycleControl`, `AdminCycleAction`, `published_at`, and `archived_at`. Backend and frontend tasks refer to the same names.
