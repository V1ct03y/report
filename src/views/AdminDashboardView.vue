<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'

import CycleControlPanel from '../components/admin/CycleControlPanel.vue'
import CycleTimelineList from '../components/admin/CycleTimelineList.vue'
import StatCard from '../components/common/StatCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import { useAppStore } from '../stores/app'
import type { Role, SchedulingConfig } from '../types'

const appStore = useAppStore()
const {
  cycleSummary,
  results,
  submissions,
  users,
  cycleOverview,
  adminCycleControl,
  schedulingConfig,
  allCycles
} = storeToRefs(appStore)

const memberForm = reactive({ username: '', fullName: '', password: 'ChangeMe123!' })
const scheduleForm = reactive({
  enabled: 0,
  open_day: 3,
  open_hour: 20,
  open_minute: 0,
  close_day: 5,
  close_hour: 20,
  close_minute: 0,
  auto_settle: 1
})
const editForm = reactive({ start_at: '', end_at: '' })
const cycleForm = reactive({ name: '', start_at: '', end_at: '' })

const scheduleSaving = ref(false)
const creatingCycle = ref(false)
const deletingCycleId = ref<number | null>(null)
const editingCycleId = ref<number | null>(null)
const actionBusy = ref(false)

const weekDays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
]

const riskyEmployees = computed(() => cycleSummary.value.isPublicVisible ? results.value.filter((item) => item.isBottomTwo) : [])
const hasWorkCycle = computed(() => Boolean(cycleOverview.value.workCycle))

function loadScheduleForm(cfg: SchedulingConfig) {
  scheduleForm.enabled = cfg.enabled
  scheduleForm.open_day = cfg.open_day
  scheduleForm.open_hour = cfg.open_hour
  scheduleForm.open_minute = cfg.open_minute
  scheduleForm.close_day = cfg.close_day
  scheduleForm.close_hour = cfg.close_hour
  scheduleForm.close_minute = cfg.close_minute
  scheduleForm.auto_settle = cfg.auto_settle
}

watch(schedulingConfig, (cfg) => {
  if (cfg) loadScheduleForm(cfg)
}, { immediate: true })

function formatCycleDate(raw: string | null) {
  if (!raw) return '未设置'
  return dayjs(raw).format('MM/DD HH:mm')
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '待开始',
    active: '进行中',
    closed: '待结算',
    settled: '已结算'
  }
  return map[status] || status
}

function startEditCycle(cycle: any) {
  editingCycleId.value = cycle.id
  editForm.start_at = cycle.start_at ? dayjs(cycle.start_at).format('YYYY-MM-DDTHH:mm') : ''
  editForm.end_at = cycle.end_at ? dayjs(cycle.end_at).format('YYYY-MM-DDTHH:mm') : ''
}

function cancelEditCycle() {
  editingCycleId.value = null
}

async function saveSchedule() {
  scheduleSaving.value = true
  try {
    await appStore.saveSchedulingConfig({ ...scheduleForm })
  } finally {
    scheduleSaving.value = false
  }
}

async function saveCycle() {
  if (!editingCycleId.value) return
  await appStore.updateExistingCycle(editingCycleId.value, {
    start_at: editForm.start_at || undefined,
    end_at: editForm.end_at || undefined
  })
  editingCycleId.value = null
}

async function handleCreateCycle() {
  if (creatingCycle.value) return
  creatingCycle.value = true
  try {
    await appStore.createNewCycle({
      name: cycleForm.name || undefined,
      start_at: cycleForm.start_at || undefined,
      end_at: cycleForm.end_at || undefined
    })
    cycleForm.name = ''
    cycleForm.start_at = ''
    cycleForm.end_at = ''
  } finally {
    creatingCycle.value = false
  }
}

async function handleDeleteCycle(id: number) {
  deletingCycleId.value = id
  try {
    await appStore.removeCycle(id)
  } finally {
    deletingCycleId.value = null
  }
}

async function handleSettle() {
  const cycleId = adminCycleControl.value.pendingPublicationCycle?.id || adminCycleControl.value.currentCycle?.id
  if (!cycleId) return
  actionBusy.value = true
  try {
    await appStore.settleCycle(cycleId)
  } finally {
    actionBusy.value = false
  }
}

async function handleAutomaticSettle() {
  await appStore.triggerAutomaticSettlement()
  await appStore.loadDashboard()
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
  appStore.loadSchedulingConfig().catch(() => undefined)
  appStore.loadAllCycles().catch(() => undefined)
})
</script>

<template>
  <div class="page-grid">
    <section class="stats-grid">
      <StatCard title="当前工作周期" :value="cycleSummary.workLabel" detail="管理员视角聚焦当前评分中的周期。" />
      <StatCard title="成员提交进度" :value="`${cycleSummary.submittedCount}/${cycleSummary.employeeCount}`" detail="只统计本期参与成员。" />
      <StatCard title="有效投票人数" :value="`${cycleSummary.validVotingCount}`" detail="已完成全部评分并取得有效投票权的人数。" />
      <StatCard title="风险成员" :value="cycleSummary.bottomTwoNames" detail="如果本期已公示，这里会显示倒数两名。" />
    </section>

    <TableSection title="周期控制中心" description="把结算、公示、归档拆成显式动作，管理员只需要处理眼前的下一步。">
      <CycleControlPanel
        :control="adminCycleControl"
        :busy="actionBusy"
        @settle="handleSettle"
        @publish="handlePublish"
        @archive="handleArchive"
        @reconcile="handleReconcile"
      />
      <CycleTimelineList :control="adminCycleControl" />
    </TableSection>

    <TableSection title="自动调度配置" :description="schedulingConfig?.description ?? '加载中…'">
      <template #actions>
        <label class="toggle-cell schedule-toggle">
          <input v-model.number="scheduleForm.enabled" type="checkbox" :true-value="1" :false-value="0" />
          <span>{{ scheduleForm.enabled ? '自动调度已启用' : '自动调度已禁用' }}</span>
        </label>
      </template>

      <div class="schedule-grid">
        <div class="schedule-row">
          <span class="schedule-label">自动开周期</span>
          <select v-model.number="scheduleForm.open_day" class="select-input schedule-select">
            <option v-for="d in weekDays" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
          <input v-model.number="scheduleForm.open_hour" type="number" min="0" max="23" class="time-input" />
          <span class="time-sep">:</span>
          <input v-model.number="scheduleForm.open_minute" type="number" min="0" max="59" class="time-input" />
        </div>
        <div class="schedule-row">
          <span class="schedule-label">自动结算</span>
          <select v-model.number="scheduleForm.close_day" class="select-input schedule-select">
            <option v-for="d in weekDays" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
          <input v-model.number="scheduleForm.close_hour" type="number" min="0" max="23" class="time-input" />
          <span class="time-sep">:</span>
          <input v-model.number="scheduleForm.close_minute" type="number" min="0" max="59" class="time-input" />
        </div>
        <div class="schedule-row">
          <label class="toggle-cell">
            <input v-model.number="scheduleForm.auto_settle" type="checkbox" :true-value="1" :false-value="0" />
            <span>结算后自动开启下一周期</span>
          </label>
        </div>
      </div>

      <div v-if="schedulingConfig" class="schedule-next">
        <span class="schedule-next__label">下次事件</span>
        <span>开周期：{{ dayjs(schedulingConfig.nextOpenAt).format('YYYY-MM-DD HH:mm') }}</span>
        <span>结算：{{ dayjs(schedulingConfig.nextCloseAt).format('YYYY-MM-DD HH:mm') }}</span>
      </div>

      <div class="schedule-actions">
        <button class="primary-button" type="button" :disabled="scheduleSaving" @click="saveSchedule">
          {{ scheduleSaving ? '保存中…' : '保存调度配置' }}
        </button>
        <span class="schedule-hint">手动建周期与自动调度现在分离，是否自动运行只由这里决定。</span>
      </div>
    </TableSection>

    <TableSection title="周期列表" description="未来周期、草稿周期和当前周期统一在这里维护。">
      <div class="cycle-create">
        <input v-model="cycleForm.name" type="text" placeholder="周期名称（可选）" class="cycle-input" />
        <input v-model="cycleForm.start_at" type="datetime-local" class="cycle-input" />
        <input v-model="cycleForm.end_at" type="datetime-local" class="cycle-input" />
        <button class="primary-button" type="button" :disabled="creatingCycle" @click="handleCreateCycle">
          {{ creatingCycle ? '创建中…' : '新增周期' }}
        </button>
        <button class="secondary-button" type="button" @click="handleAutomaticSettle">触发自动结算</button>
      </div>

      <div class="overview-grid overview-grid--four">
        <article class="surface-card overview-card">
          <h4>当前阶段</h4>
          <p>{{ cycleSummary.stageLabel }}</p>
          <h4>当前截止时间</h4>
          <p>{{ cycleSummary.deadlineExact }}</p>
        </article>

        <article class="surface-card overview-note">
          <h4>关注成员</h4>
          <div class="chip-list">
            <StatusBadge v-for="employee in riskyEmployees" :key="employee.employeeId" tone="danger">
              {{ employee.name }} 位于倒数两名
            </StatusBadge>
            <StatusBadge v-if="!riskyEmployees.length" tone="muted">当前没有</StatusBadge>
          </div>
        </article>
      </div>

      <div class="cycle-list">
        <div
          v-for="cycle in allCycles"
          :key="cycle.id"
          class="cycle-item surface-card"
          :class="{ 'cycle-item--settled': cycle.status === 'settled', 'cycle-item--draft': cycle.status === 'draft' }"
        >
          <div class="cycle-item__info">
            <strong>{{ cycle.name || `第${cycle.week_number ?? '-'}周` }}</strong>
            <StatusBadge :tone="cycle.status === 'settled' ? 'success' : cycle.status === 'active' ? 'warning' : 'muted'">
              {{ statusLabel(cycle.status) }}
            </StatusBadge>
            <span class="cycle-item__dates">{{ formatCycleDate(cycle.start_at) }} - {{ formatCycleDate(cycle.end_at) }}</span>
          </div>

          <div class="cycle-item__actions">
            <template v-if="editingCycleId === cycle.id">
              <input v-model="editForm.start_at" type="datetime-local" class="cycle-input cycle-input--inline" />
              <input v-model="editForm.end_at" type="datetime-local" class="cycle-input cycle-input--inline" />
              <button class="secondary-button" type="button" @click="saveCycle">保存</button>
              <button class="secondary-button" type="button" @click="cancelEditCycle">取消</button>
            </template>
            <template v-else>
              <button v-if="cycle.status === 'draft'" class="secondary-button" type="button" @click="startEditCycle(cycle)">
                调整时间
              </button>
              <button
                v-if="cycle.status === 'draft'"
                class="danger-button"
                type="button"
                :disabled="deletingCycleId === cycle.id"
                @click="handleDeleteCycle(cycle.id)"
              >
                {{ deletingCycleId === cycle.id ? '删除中…' : '删除' }}
              </button>
            </template>
          </div>
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
                <label class="toggle-cell">
                  <input
                    type="checkbox"
                    :checked="user.is_participant !== 0"
                    :disabled="!hasWorkCycle"
                    @change="handleParticipationChange(user.id, ($event.target as HTMLInputElement).checked)"
                  />
                  <span>{{ user.is_participant !== 0 ? '参与' : '不参与' }}</span>
                </label>
              </template>
              <span v-else>不适用</span>
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

    <TableSection title="结果预览" description="管理员可在这里预览当前公示周期或待公示周期的结果。">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>提交时间</th>
            <th>投票权</th>
            <th>最终分</th>
            <th>排名</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in results" :key="item.employeeId">
            <td>{{ item.name }}</td>
            <td>{{ submissions[item.employeeId]?.submittedAt ?? '未提交' }}</td>
            <td>{{ submissions[item.employeeId]?.usedVotingRight ? '有效' : '无效' }}</td>
            <td>{{ item.finalScore.toFixed(2) }}</td>
            <td>#{{ item.rank }}</td>
          </tr>
        </tbody>
      </table>
    </TableSection>
  </div>
</template>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.overview-card,
.overview-note {
  padding: 1.15rem;
}

.overview-card h4,
.overview-note h4 {
  margin: 0.9rem 0 0.45rem;
  font-family: var(--font-display);
}

.overview-card p,
.overview-note ul {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.75;
}

.chip-list {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dashboard-table {
  width: 100%;
  border-collapse: collapse;
}

.dashboard-table th,
.dashboard-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid rgba(214, 191, 160, 0.55);
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
  border-radius: 12px;
  border: 1px solid rgba(213, 176, 132, 0.8);
  background: rgba(255, 253, 249, 0.96);
}

.toggle-cell {
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
}

.schedule-toggle {
  font-size: 0.9rem;
  color: var(--text-soft);
}

.schedule-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0.75rem 0;
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.schedule-label {
  min-width: 6rem;
  font-size: 0.9rem;
  color: var(--text-soft);
}

.schedule-select {
  min-width: 5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 10px;
  border: 1px solid rgba(213, 176, 132, 0.8);
  background: rgba(255, 253, 249, 0.96);
  font-size: 0.88rem;
}

.time-input {
  width: 3.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 10px;
  border: 1px solid rgba(213, 176, 132, 0.8);
  background: rgba(255, 253, 249, 0.96);
  font-size: 0.88rem;
  text-align: center;
}

.time-sep {
  font-weight: 600;
  color: var(--text-soft);
}

.schedule-next {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  background: rgba(213, 176, 132, 0.12);
  font-size: 0.85rem;
  color: var(--text-soft);
  margin-bottom: 0.75rem;
}

.schedule-next__label {
  font-weight: 600;
  color: var(--text-primary);
}

.schedule-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.schedule-hint {
  font-size: 0.82rem;
  color: var(--text-soft);
}

.overview-grid--four {
  margin-bottom: 1rem;
}

.cycle-create {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto auto;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.cycle-input {
  padding: 0.5rem 0.7rem;
  border-radius: 12px;
  border: 1px solid rgba(213, 176, 132, 0.8);
  background: rgba(255, 253, 249, 0.96);
  font-size: 0.88rem;
  width: 100%;
}

.cycle-input--inline {
  width: auto;
  flex: 1;
}

.cycle-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cycle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  gap: 1rem;
}

.cycle-item__info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cycle-item__info strong {
  font-family: var(--font-display);
}

.cycle-item__dates {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.cycle-item__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.danger-button {
  padding: 0.4rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(184, 91, 70, 0.6);
  background: rgba(184, 91, 70, 0.08);
  color: #b86b50;
  font-size: 0.83rem;
  cursor: pointer;
  transition: background 0.15s;
}

.danger-button:hover {
  background: rgba(184, 91, 70, 0.16);
}

.danger-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1023px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .member-form,
  .cycle-create {
    grid-template-columns: 1fr;
  }

  .schedule-row {
    flex-wrap: wrap;
  }

  .schedule-next {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
