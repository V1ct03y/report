<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'

import PasswordChangePanel from '../components/account/PasswordChangePanel.vue'
import CycleControlPanel from '../components/admin/CycleControlPanel.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import { useAppStore } from '../stores/app'
import type { CycleRecord, Role } from '../types'

const appStore = useAppStore()
const {
  cycleSummary,
  results,
  users,
  cycleOverview,
  adminCycleControl,
  allCycles
} = storeToRefs(appStore)

const memberForm = reactive({ username: '', fullName: '', password: 'ChangeMe123!' })
const editForm = reactive({ start_at: '', end_at: '' })

const deletingCycleId = ref<number | null>(null)
const editingCycleId = ref<number | null>(null)
const actionBusy = ref(false)

const riskyEmployees = computed(() => (
  cycleSummary.value.isPublicVisible
    ? results.value.filter((item) => item.isBottomTwo)
    : []
))
const riskyCountText = computed(() => (
  cycleSummary.value.isPublicVisible ? `${riskyEmployees.value.length} 人` : '待公示'
))
const riskyDetailText = computed(() => (
  cycleSummary.value.isPublicVisible
    ? (cycleSummary.value.bottomTwoNames === '-' ? '当前没有倒数两名名单。' : cycleSummary.value.bottomTwoNames)
    : '位于倒数两名 · 公示后可见'
))

const hasWorkCycle = computed(() => Boolean(cycleOverview.value.workCycle))
const editingCycle = computed(() => (
  allCycles.value.find((cycle) => cycle.id === editingCycleId.value) ?? null
))

function formatCycleDate(raw: string | null) {
  if (!raw) return '未设置'
  return dayjs(raw).format('MM/DD HH:mm')
}

function resolveCycleName(cycle: CycleRecord) {
  if (cycle.name) return cycle.name
  if (cycle.week_number != null) return `第${cycle.week_number}周工作评分`
  return `周期 #${cycle.id}`
}

function resolveCyclePhase(cycle: CycleRecord) {
  if (cycle.archived_at || cycle.is_archived === 1) return 'archived'
  if (cycle.published_at || cycle.public_at) return 'published'
  if (cycle.status === 'settled') return 'settled'
  if (cycle.status === 'closed') return 'closed'
  if (cycle.status === 'active') return 'open'
  return 'planned'
}

function statusTone(cycle: CycleRecord) {
  const phase = resolveCyclePhase(cycle)
  if (phase === 'published') return 'success'
  if (phase === 'settled' || phase === 'closed' || phase === 'open') return 'warning'
  return 'muted'
}

function statusLabel(cycle: CycleRecord) {
  const labels: Record<string, string> = {
    planned: '待开始',
    open: '进行中',
    closed: '待结算',
    settled: '待公示',
    published: '公示中',
    archived: '已归档'
  }
  return labels[resolveCyclePhase(cycle)] || cycle.status
}

function cycleMetaText(cycle: CycleRecord) {
  if (cycle.archived_at) {
    return `归档于 ${dayjs(cycle.archived_at).format('MM/DD HH:mm')}`
  }
  if (cycle.published_at) {
    return `公示于 ${dayjs(cycle.published_at).format('MM/DD HH:mm')}`
  }
  if (cycle.settled_at) {
    return `结算于 ${dayjs(cycle.settled_at).format('MM/DD HH:mm')}`
  }
  return ''
}

function canEditCycle(cycle: CycleRecord) {
  const phase = resolveCyclePhase(cycle)
  return phase === 'planned' || phase === 'open' || phase === 'closed'
}

function canDeleteCycle(cycle: CycleRecord) {
  return resolveCyclePhase(cycle) === 'planned'
}

function canSettleCycle(cycle: CycleRecord) {
  const phase = resolveCyclePhase(cycle)
  return phase === 'open' || phase === 'closed'
}

function canPublishCycle(cycle: CycleRecord) {
  return resolveCyclePhase(cycle) === 'settled'
}

function canArchiveCycle(cycle: CycleRecord) {
  return resolveCyclePhase(cycle) === 'published'
}

function startEditCycle(cycle: CycleRecord) {
  editingCycleId.value = cycle.id
  editForm.start_at = cycle.start_at ? dayjs(cycle.start_at).format('YYYY-MM-DDTHH:mm') : ''
  editForm.end_at = cycle.end_at ? dayjs(cycle.end_at).format('YYYY-MM-DDTHH:mm') : ''
}

function cancelEditCycle() {
  editingCycleId.value = null
  editForm.start_at = ''
  editForm.end_at = ''
}

async function saveCycle() {
  if (!editingCycleId.value) return
  const candidateStart = editForm.start_at || editingCycle.value?.start_at || ''
  const candidateEnd = editForm.end_at || editingCycle.value?.end_at || ''
  const now = dayjs()
  const movesIntoPast = [candidateStart, candidateEnd].some((value) => value && dayjs(value).isBefore(now))

  if (movesIntoPast) {
    const confirmed = window.confirm(
      '这个周期时间早于当前时间。保存后系统会立即按当前时间推进状态，可能直接变成进行中、待结算或待公示。确定继续吗？'
    )
    if (!confirmed) return
  }

  await appStore.updateExistingCycle(editingCycleId.value, {
    start_at: editForm.start_at || undefined,
    end_at: editForm.end_at || undefined
  })
  cancelEditCycle()
}

async function handleDeleteCycle(id: number) {
  deletingCycleId.value = id
  try {
    await appStore.removeCycle(id)
  } finally {
    deletingCycleId.value = null
  }
}

async function handleSettle(cycleId?: number) {
  const resolvedId = cycleId
    ?? adminCycleControl.value.pendingPublicationCycle?.id
    ?? adminCycleControl.value.currentCycle?.id
  if (!resolvedId) return
  actionBusy.value = true
  try {
    await appStore.settleCycle(resolvedId)
  } finally {
    actionBusy.value = false
  }
}

async function handlePublish(id: number) {
  actionBusy.value = true
  try {
    await appStore.publishCycleResults(id)
  } finally {
    actionBusy.value = false
  }
}

async function handleArchive(id: number) {
  actionBusy.value = true
  try {
    await appStore.archiveCycleResults(id)
  } finally {
    actionBusy.value = false
  }
}

async function handleReconcile() {
  actionBusy.value = true
  try {
    await appStore.reconcileAdminCycles()
  } finally {
    actionBusy.value = false
  }
}

async function handleCreateMember() {
  if (!memberForm.username || !memberForm.fullName) return
  await appStore.createMember(memberForm)
  memberForm.username = ''
  memberForm.fullName = ''
  memberForm.password = 'ChangeMe123!'
}

async function handleRoleChange(id: number, role: Role) {
  await appStore.changeUserRole(id, role)
}

async function handleParticipationChange(id: number, isParticipant: boolean) {
  await appStore.changeUserParticipation(id, isParticipant)
}

async function handleActiveToggle(id: number, currentActive: number) {
  await appStore.changeUserActive(id, currentActive !== 1)
}

async function handleDeactivateSelf() {
  await appStore.deactivateSelf()
}

onMounted(() => {
  appStore.loadDashboard().catch(() => undefined)
  appStore.loadPublicResults().catch(() => undefined)
  appStore.loadAdminCycleControl().catch(() => undefined)
  appStore.loadAllCycles().catch(() => undefined)
})
</script>

<template>
  <div class="page-grid">
    <section class="kpi-section">
      <p class="kpi-section__eyebrow">关键指标</p>
      <div class="kpi-strip">
        <article class="kpi-item">
          <span class="kpi-item__label">当前工作周期</span>
          <strong class="kpi-item__value">{{ cycleSummary.workLabel }}</strong>
          <p class="kpi-item__detail">{{ cycleSummary.currentPeriodText }}</p>
        </article>
        <article class="kpi-item">
          <span class="kpi-item__label">成员提交进度</span>
          <strong class="kpi-item__value">{{ cycleSummary.submittedCount }} / {{ cycleSummary.employeeCount }}</strong>
          <p class="kpi-item__detail">只统计本期参与成员</p>
        </article>
        <article class="kpi-item">
          <span class="kpi-item__label">有效投票人数</span>
          <strong class="kpi-item__value">{{ cycleSummary.validVotingCount }}</strong>
          <p class="kpi-item__detail">已完成全部评分并取得有效投票权</p>
        </article>
        <article class="kpi-item">
          <span class="kpi-item__label">风险成员</span>
          <strong class="kpi-item__value kpi-item__value--accent">{{ riskyCountText }}</strong>
          <p class="kpi-item__detail">{{ riskyDetailText }}</p>
        </article>
      </div>
    </section>

    <TableSection title="周期控制中心" description="结算、公示、归档都集中在这里处理。">
      <CycleControlPanel
        :control="adminCycleControl"
        :busy="actionBusy"
        @settle="handleSettle"
        @publish="handlePublish"
        @archive="handleArchive"
        @reconcile="handleReconcile"
      />
    </TableSection>

    <TableSection title="周期列表" description="可查看并调整当前与后续周期的时间。">
      <div class="cycle-board">
        <div class="overview-grid">
          <article class="surface-card overview-card">
            <span class="overview-card__label">当前阶段</span>
            <strong>{{ cycleSummary.stageLabel }}</strong>
            <p>{{ cycleSummary.deadlineExact }}</p>
          </article>

          <article class="surface-card overview-card">
            <span class="overview-card__label">关注成员</span>
            <div class="chip-list">
              <StatusBadge v-for="employee in riskyEmployees" :key="employee.employeeId" tone="danger">
                {{ employee.name }} 位于倒数两名
              </StatusBadge>
              <StatusBadge v-if="!riskyEmployees.length" tone="muted">当前没有</StatusBadge>
            </div>
          </article>
        </div>

        <div class="cycle-list">
          <article
            v-for="cycle in allCycles"
            :key="cycle.id"
            class="cycle-item surface-card"
          >
            <div class="cycle-item__main">
              <div class="cycle-item__title">
                <strong>{{ resolveCycleName(cycle) }}</strong>
                <StatusBadge :tone="statusTone(cycle)">{{ statusLabel(cycle) }}</StatusBadge>
              </div>
              <p class="cycle-item__dates">{{ formatCycleDate(cycle.start_at) }} - {{ formatCycleDate(cycle.end_at) }}</p>
              <p v-if="cycleMetaText(cycle)" class="cycle-item__meta">{{ cycleMetaText(cycle) }}</p>
            </div>

            <div class="cycle-item__actions">
              <template v-if="editingCycleId === cycle.id">
                <input v-model="editForm.start_at" type="datetime-local" class="cycle-input cycle-input--inline" />
                <input v-model="editForm.end_at" type="datetime-local" class="cycle-input cycle-input--inline" />
                <button class="cycle-action-button cycle-action-button--primary" type="button" @click="saveCycle">
                  保存时间
                </button>
                <button class="cycle-action-button" type="button" @click="cancelEditCycle">
                  取消
                </button>
              </template>

              <template v-else>
                <button
                  v-if="canSettleCycle(cycle)"
                  class="cycle-action-button cycle-action-button--primary"
                  type="button"
                  :disabled="actionBusy"
                  @click="handleSettle(cycle.id)"
                >
                  手动结算
                </button>
                <button
                  v-if="canPublishCycle(cycle)"
                  class="cycle-action-button cycle-action-button--primary"
                  type="button"
                  :disabled="actionBusy"
                  @click="handlePublish(cycle.id)"
                >
                  确认公示
                </button>
                <button
                  v-if="canArchiveCycle(cycle)"
                  class="cycle-action-button"
                  type="button"
                  :disabled="actionBusy"
                  @click="handleArchive(cycle.id)"
                >
                  归档
                </button>
                <button
                  v-if="canEditCycle(cycle)"
                  class="cycle-action-button"
                  type="button"
                  :disabled="actionBusy"
                  @click="startEditCycle(cycle)"
                >
                  调整时间
                </button>
                <button
                  v-if="canDeleteCycle(cycle)"
                  class="cycle-action-button cycle-action-button--danger"
                  type="button"
                  :disabled="deletingCycleId === cycle.id || actionBusy"
                  @click="handleDeleteCycle(cycle.id)"
                >
                  {{ deletingCycleId === cycle.id ? '删除中…' : '删除' }}
                </button>
              </template>
            </div>
          </article>
        </div>
      </div>
    </TableSection>

    <TableSection title="账号管理" description="统一管理角色、账号状态和本期参与资格。">
      <div class="member-form">
        <input v-model="memberForm.fullName" type="text" placeholder="成员姓名" />
        <input v-model="memberForm.username" type="text" placeholder="登录账号" />
        <input v-model="memberForm.password" type="text" placeholder="初始密码" />
        <button class="primary-button" type="button" @click="handleCreateMember">新增成员账号</button>
      </div>

      <div class="admin-actions">
        <button class="secondary-button" type="button" @click="handleDeactivateSelf">停用我的账号</button>
      </div>

      <table class="dashboard-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>账号</th>
            <th>角色</th>
            <th>本期参与</th>
            <th>提交时间</th>
            <th>投票权</th>
            <th>账号状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.full_name }}</td>
            <td>{{ user.username }}</td>
            <td>
              <select
                class="select-input"
                :value="user.role"
                @change="handleRoleChange(user.id, ($event.target as HTMLSelectElement).value as Role)"
              >
                <option value="admin">admin</option>
                <option value="leader">leader</option>
                <option value="member">member</option>
              </select>
            </td>
            <td>
              <template v-if="user.role === 'member' || user.role === 'leader'">
                <select
                  class="select-input select-input--compact"
                  :value="user.is_participant !== 0 ? 'participating' : 'not_participating'"
                  :disabled="!hasWorkCycle"
                  @change="handleParticipationChange(user.id, ($event.target as HTMLSelectElement).value === 'participating')"
                >
                  <option value="participating">参与</option>
                  <option value="not_participating">不参与</option>
                </select>
              </template>
              <span v-else class="select-input select-input--compact select-input--readonly">不适用</span>
            </td>
            <td>{{ user.submitted_at ?? '未提交' }}</td>
            <td>{{ user.used_voting_right === 1 ? '有效' : '未生效' }}</td>
            <td>{{ user.is_active === 1 ? '启用' : '停用' }}</td>
            <td>
              <button class="secondary-button" type="button" @click="handleActiveToggle(user.id, user.is_active)">
                {{ user.is_active === 1 ? '停用账号' : '启用账号' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </TableSection>

    <TableSection title="账户安全" description="可在这里修改当前管理员密码。">
      <PasswordChangePanel />
    </TableSection>
  </div>
</template>

<style scoped>
.kpi-section {
  display: grid;
  gap: 0.8rem;
}

.kpi-section__eyebrow {
  margin: 0;
  color: var(--brand-strong);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background: rgba(252, 248, 239, 0.9);
  overflow: hidden;
}

.kpi-item {
  padding: 1.35rem 1.2rem 1.25rem;
  min-height: 9.8rem;
  display: grid;
  align-content: start;
  gap: 0.62rem;
}

.kpi-item + .kpi-item {
  border-left: 1px solid var(--line-soft);
}

.kpi-item__label {
  color: var(--text-soft);
  font-size: 0.92rem;
  font-weight: 600;
}

.kpi-item__value {
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: clamp(2rem, 3.2vw, 2.8rem);
  line-height: 1;
}

.kpi-item__value--accent {
  color: var(--brand);
}

.kpi-item__detail {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
}

.dashboard-table {
  width: 100%;
  border-collapse: collapse;
}

.dashboard-table th,
.dashboard-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
}

.member-form {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr auto;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.admin-actions {
  margin-bottom: 0.8rem;
}

.select-input {
  min-width: 7.6rem;
  padding: 0.55rem 0.65rem;
  border-radius: 14px;
  border: 1px solid var(--line-soft);
  background: rgba(252, 248, 239, 0.96);
}

.select-input--compact {
  min-width: 6.6rem;
}

.select-input--readonly {
  display: inline-flex;
  align-items: center;
  color: var(--text-soft);
}

.cycle-board {
  display: grid;
  gap: 1rem;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.overview-card {
  display: grid;
  gap: 0.5rem;
  padding: 1.15rem;
  min-height: 9.5rem;
  align-content: start;
}

.overview-card strong {
  font-family: var(--font-display);
  font-size: 1.6rem;
  line-height: 1.15;
}

.overview-card__label {
  color: var(--text-soft);
  font-size: 0.84rem;
}

.overview-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.chip-list {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cycle-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.cycle-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.15rem;
}

.cycle-item__main {
  min-width: 0;
  display: grid;
  gap: 0.35rem;
}

.cycle-item__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cycle-item__title strong {
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.cycle-item__dates,
.cycle-item__meta {
  margin: 0;
  color: var(--text-soft);
}

.cycle-item__meta {
  font-size: 0.85rem;
}

.cycle-item__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.cycle-input {
  padding: 0.62rem 0.8rem;
  border-radius: 14px;
  border: 1px solid var(--line-soft);
  background: rgba(252, 248, 239, 0.96);
  font-size: 0.9rem;
  width: 100%;
}

.cycle-input--inline {
  width: min(14rem, 100%);
}

.cycle-action-button {
  min-width: 6.75rem;
  min-height: 3rem;
  padding: 0.7rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--line-soft);
  background: rgba(252, 248, 239, 0.96);
  color: var(--text-strong);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.cycle-action-button:hover {
  background: rgba(236, 226, 210, 0.95);
  transform: translateY(-1px);
}

.cycle-action-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.cycle-action-button--primary {
  background: var(--brand);
  border-color: var(--brand);
  color: #fdf8ef;
}

.cycle-action-button--primary:hover {
  background: var(--brand-strong);
  border-color: var(--brand-strong);
}

.cycle-action-button--danger {
  border-color: rgba(184, 91, 70, 0.65);
  background: rgba(184, 91, 70, 0.08);
  color: #b85b46;
}

.cycle-action-button--danger:hover {
  background: rgba(184, 91, 70, 0.16);
  border-color: rgba(184, 91, 70, 0.78);
}

@media (max-width: 1023px) {
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kpi-item:nth-child(3),
  .kpi-item:nth-child(4) {
    border-top: 1px solid var(--line-soft);
  }

  .kpi-item:nth-child(3) {
    border-left: 0;
  }

  .overview-grid,
  .member-form {
    grid-template-columns: 1fr;
  }

  .cycle-item {
    grid-template-columns: 1fr;
  }

  .cycle-item__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 767px) {
  .kpi-strip {
    grid-template-columns: 1fr;
  }

  .kpi-item + .kpi-item {
    border-left: 0;
    border-top: 1px solid var(--line-soft);
  }

  .kpi-item {
    min-height: auto;
    padding: 1.1rem 1rem;
  }

  .cycle-item__actions {
    gap: 0.55rem;
  }

  .cycle-action-button,
  .cycle-input--inline {
    width: 100%;
  }
}
</style>
