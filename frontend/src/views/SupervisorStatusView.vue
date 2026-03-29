<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const { currentLeader, leaderSubmissions } = storeToRefs(appStore)

const currentSubmission = computed(() =>
  currentLeader.value ? leaderSubmissions.value[currentLeader.value.id] : null
)

const statusTone = computed(() => {
  if (!currentSubmission.value?.isEffective) return 'danger'
  if (!currentSubmission.value?.isComplete) return 'warning'
  return 'success'
})

const statusText = computed(() => {
  if (!currentSubmission.value?.isEffective) return '未生效'
  if (!currentSubmission.value?.isComplete) return '部分生效'
  return '已全部生效'
})

const headingText = computed(() => {
  if (!currentSubmission.value?.isEffective) return '你的组长评分尚未保存到结算数据。'
  if (!currentSubmission.value?.isComplete) return '你的组长评分已部分生效，但仍有成员未录入。'
  return '你的组长评分已完整保存，将参与本期结算。'
})

const descriptionText = computed(() => {
  if (!currentSubmission.value?.isEffective) {
    return '当前数据库里还没有你的组长评分记录，本期不会体现你的组长评分权重。'
  }

  if (!currentSubmission.value?.isComplete) {
    return '已保存的成员评分会参与结算，尚未录入的成员在当前预览和结算中会按 0 分处理。'
  }

  return '当前参与成员都已有你的组长评分记录，管理员结算时会按组长总权重纳入最终分。'
})
</script>

<template>
  <div class="page-grid">
    <section class="surface-card status-panel">
      <StatusBadge :tone="statusTone">
        {{ statusText }}
      </StatusBadge>
      <h3>{{ headingText }}</h3>
      <p>{{ descriptionText }}</p>
    </section>

    <TableSection title="组长评分状态" description="用于组长确认自己的评分是否已经写入后端，并判断是否完整生效。">
      <table class="status-table">
        <tbody>
          <tr>
            <th>组长</th>
            <td>{{ currentLeader?.name ?? '-' }}</td>
          </tr>
          <tr>
            <th>最后保存时间</th>
            <td>{{ currentSubmission?.submittedAt ?? '尚未保存' }}</td>
          </tr>
          <tr>
            <th>已保存人数</th>
            <td>{{ currentSubmission ? `${currentSubmission.savedCount} / ${currentSubmission.requiredCount}` : '-' }}</td>
          </tr>
          <tr>
            <th>当前状态</th>
            <td>{{ statusText }}</td>
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
