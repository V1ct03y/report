<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const { currentEmployee, submissions, results, cycle, publicCycle } = storeToRefs(appStore)

const currentSubmission = computed(() =>
  currentEmployee.value ? submissions.value[currentEmployee.value.id] : null
)

const currentResult = computed(() =>
  publicCycle.value?.id === cycle.value?.id
    ? results.value.find((item) => item.employeeId === currentEmployee.value?.id) ?? null
    : null
)
</script>

<template>
  <div class="page-grid">
    <section class="surface-card status-panel">
      <StatusBadge :tone="currentSubmission?.usedVotingRight ? 'success' : 'danger'">
        {{ currentSubmission?.usedVotingRight ? '评分权有效' : '未使用评分权' }}
      </StatusBadge>
      <h3>
        {{
          currentSubmission?.usedVotingRight
            ? '你的评分已计入本期结算。'
            : '你未完成全员评分，本期评分权未生效。'
        }}
      </h3>
      <p>
        {{
          currentSubmission?.usedVotingRight
            ? '你的自评分和对他人的评分会参与结算。'
            : '根据规则，你给他人的评分全部无效，自评分按 0 计入本人最终分，但仍参与被评分和最终排名。'
        }}
      </p>
    </section>

    <TableSection title="个人结算状态" description="用于成员提交后的确认与结果解释。">
      <table class="status-table">
        <tbody>
          <tr>
            <th>提交时间</th>
            <td>{{ currentSubmission?.submittedAt ?? '尚未提交' }}</td>
          </tr>
          <tr>
            <th>评分权</th>
            <td>{{ currentSubmission?.usedVotingRight ? '已生效' : '未生效' }}</td>
          </tr>
          <tr>
            <th>当前最终分</th>
            <td>{{ currentResult?.finalScore ?? '-' }}</td>
          </tr>
          <tr>
            <th>当前排名</th>
            <td>{{ currentResult?.rank ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </TableSection>
  </div>
</template>

<style scoped>
.status-panel h3 {
  margin: 1rem 0 0;
  font-family: var(--font-display);
  font-size: 2rem;
}

.status-panel p {
  margin: 0.9rem 0 0;
  color: var(--text-muted);
  line-height: 1.8;
}

.status-table {
  width: 100%;
  border-collapse: collapse;
}

.status-table th,
.status-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
}

.status-table th {
  width: 11rem;
  color: var(--text-soft);
}
</style>
