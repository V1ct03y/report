<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { storeToRefs } from 'pinia'

import StatCard from '../components/common/StatCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import { useAppStore } from '../stores/app'
import type { Role } from '../types'

const appStore = useAppStore()
const { cycleSummary, results, submissions, users, cycleOverview } = storeToRefs(appStore)
const memberForm = reactive({ username: '', fullName: '', password: 'ChangeMe123!' })

const riskyEmployees = computed(() => cycleSummary.value.isPublicVisible ? results.value.filter((item) => item.isBottomTwo) : [])
const hasWorkCycle = computed(() => Boolean(cycleOverview.value.workCycle))

async function handleSettle() {
  await appStore.settleCycle(cycleOverview.value.workCycle?.id)
}

async function handleAutomaticSettle() {
  await appStore.triggerAutomaticSettlement()
  await appStore.loadDashboard()
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
})
</script>

<template>
  <div class="page-grid">
    <section class="stats-grid">
      <StatCard title="当前评分周期" :value="cycleSummary.workLabel" detail="当前可提交评分的 work 周期。" />
      <StatCard title="成员提交进度" :value="`${cycleSummary.submittedCount}/${cycleSummary.employeeCount}`" detail="仅统计本期参与成员。" />
      <StatCard title="评分权有效人数" :value="`${cycleSummary.validVotingCount}`" detail="已完成全员评分并生效的成员数量。" />
      <StatCard title="风险成员" :value="cycleSummary.bottomTwoNames" detail="取当前公示结果中的倒数两名成员。" />
    </section>

    <TableSection title="周期管理" description="支持手动结算，或触发自动结算检查。">
      <template #actions>
        <button class="secondary-button" type="button" @click="handleAutomaticSettle">触发自动结算检查</button>
        <button class="primary-button" type="button" @click="handleSettle">立即结算当前周期</button>
      </template>

      <div class="overview-grid">
        <article class="surface-card overview-card">
          <h4>当前阶段</h4>
          <p>{{ cycleSummary.stageLabel }}</p>
          <h4>截止时间</h4>
          <p>{{ cycleSummary.deadlineExact }}</p>
        </article>

        <article class="surface-card overview-note">
          <h4>风险成员</h4>
          <div class="chip-list">
            <StatusBadge
              v-for="employee in riskyEmployees"
              :key="employee.employeeId"
              tone="danger"
            >
              {{ employee.name }} 位于倒数两名
            </StatusBadge>
            <StatusBadge v-if="!riskyEmployees.length" tone="muted">当前暂无已公示风险成员</StatusBadge>
          </div>
        </article>
      </div>
    </TableSection>

    <TableSection title="账号管理" description="管理角色、账号状态以及当前评分周期参与开关。">
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
            <th>提交状态</th>
            <th>评分权</th>
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
              <button
                class="secondary-button"
                type="button"
                @click="handleActiveToggle(user.id, user.is_active)"
              >
                {{ user.is_active === 1 ? '停用账号' : '启用账号' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </TableSection>

    <TableSection title="当前公示周期结果" description="用于核对最新 public 周期的最终得分、排名与评分权状态。">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>提交时间</th>
            <th>评分权</th>
            <th>最终分</th>
            <th>排名</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in results" :key="item.employeeId">
            <td>{{ item.name }}</td>
            <td>{{ submissions[item.employeeId]?.submittedAt ?? '未提交' }}</td>
            <td>{{ submissions[item.employeeId]?.usedVotingRight ? 'true' : 'false' }}</td>
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

@media (max-width: 1200px) {
  .overview-grid,
  .member-form {
    grid-template-columns: 1fr;
  }
}
</style>
