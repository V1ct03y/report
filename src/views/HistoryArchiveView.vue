<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'

import TableSection from '../components/common/TableSection.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import AnonymousMatrix from '../components/public/AnonymousMatrix.vue'
import { api } from '../api'
import type { CycleRecord, PublicMatrixRow } from '../types'

const cycles = ref<CycleRecord[]>([])
const activeCycle = ref<CycleRecord | null>(null)
const columns = ref<string[]>([])
const matrixRows = ref<PublicMatrixRow[]>([])
const ranking = ref<Array<{ userId: number; fullName: string; finalScore: number; rankPosition: number; usedVotingRight: boolean }>>([])

const activePeriodText = computed(() => {
  if (!activeCycle.value?.start_at || !activeCycle.value?.end_at) return '周期时间未设置'
  return `${dayjs(activeCycle.value.start_at).format('MM月DD日 HH:mm')} - ${dayjs(activeCycle.value.end_at).format('MM月DD日 HH:mm')}`
})

async function loadHistory() {
  const history = await api.getCycleHistory()
  cycles.value = (history.cycles || []) as CycleRecord[]
  if (cycles.value.length) {
    await loadCycle(cycles.value[0].id)
  }
}

async function loadCycle(id: number) {
  const payload = await api.getCycleResults(id)
  activeCycle.value = payload.cycle as CycleRecord
  columns.value = (payload.employees || []).map((item: any) => item.full_name)
  matrixRows.value = (payload.matrix || []).map((row: any, index: number) => ({
    rowLabel: `匿名-${String(index + 1).padStart(2, '0')}`,
    employeeId: String(row.anonymousRowKey || index + 1),
    values: (row.values || []).map((value: any) => value === false ? false : (value == null ? null : Number(value))),
    valid: Boolean(row.valid)
  }))
  ranking.value = payload.ranking || []
}

onMounted(loadHistory)
</script>

<template>
  <div class="archive-layout">
    <TableSection
      class="archive-sidebar"
      title="历史归档"
      description="已从当前公示区归档的周期都会保留在这里，支持随时复查。"
    >
      <div class="archive-list">
        <button
          v-for="cycle in cycles"
          :key="cycle.id"
          class="secondary-button archive-list__item"
          :class="{ 'archive-list__item--active': activeCycle?.id === cycle.id }"
          type="button"
          @click="loadCycle(cycle.id)"
        >
          <strong>{{ cycle.week_number ? `第${cycle.week_number}周` : cycle.name }}</strong>
          <span>{{ cycle.settle_mode === 'manual' ? '手动结算' : '自动结算' }}</span>
        </button>
      </div>
    </TableSection>

    <TableSection
      class="archive-detail"
      :title="activeCycle?.week_number ? `第${activeCycle.week_number}周历史公示` : '历史公示'"
      description="查看指定归档周期的匿名矩阵、最终排名与结算方式。"
    >
      <div v-if="activeCycle" class="page-grid">
        <section class="archive-summary">
          <div>
            <StatusBadge tone="muted">{{ activeCycle.settle_mode === 'manual' ? '手动结算' : '自动结算' }}</StatusBadge>
            <h3>{{ activeCycle.week_number ? `第${activeCycle.week_number}周` : activeCycle.name }}</h3>
            <p>{{ activePeriodText }}</p>
          </div>
          <div class="archive-summary__meta">
            <div>
              <span>公示时间</span>
              <strong>{{ activeCycle.public_at || '未记录' }}</strong>
            </div>
            <div>
              <span>归档状态</span>
              <strong>{{ activeCycle.is_archived === 1 ? '已归档' : '当前公示' }}</strong>
            </div>
          </div>
        </section>

        <AnonymousMatrix :columns="columns" :rows="matrixRows" />

        <table class="results-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>成员</th>
              <th>最终分</th>
              <th>评分权</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in ranking" :key="item.userId">
              <td>#{{ item.rankPosition }}</td>
              <td>{{ item.fullName }}</td>
              <td>{{ Number(item.finalScore).toFixed(2) }}</td>
              <td>{{ item.usedVotingRight ? '有效' : '未生效' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </TableSection>
  </div>
</template>

<style scoped>
.archive-layout {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 1.1rem;
  align-items: start;
}

.archive-sidebar {
  position: sticky;
  top: 0;
}

.archive-detail {
  min-width: 0;
}

.archive-list {
  display: grid;
  gap: 0.75rem;
  max-height: min(60vh, 34rem);
  overflow-y: auto;
  padding-right: 0.2rem;
  align-content: start;
}

.archive-list__item {
  display: grid;
  gap: 0.3rem;
  justify-items: start;
}

.archive-list__item--active {
  border-color: rgba(212, 169, 118, 0.85);
  background: rgba(243, 188, 104, 0.15);
}

.archive-list__item span {
  color: var(--text-soft);
  font-size: 0.88rem;
}

.archive-summary {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid rgba(214, 191, 160, 0.55);
  border-radius: 24px;
  background: rgba(255, 249, 241, 0.7);
}

.archive-summary h3 {
  margin: 0.7rem 0 0.4rem;
  font-family: var(--font-display);
  font-size: 1.6rem;
}

.archive-summary p {
  margin: 0;
  color: var(--text-muted);
}

.archive-summary__meta {
  display: grid;
  gap: 0.8rem;
}

.archive-summary__meta span {
  display: block;
  color: var(--text-soft);
  font-size: 0.82rem;
}

.archive-summary__meta strong {
  display: block;
  margin-top: 0.3rem;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid rgba(214, 191, 160, 0.55);
  text-align: left;
}

@media (max-width: 1023px) {
  .archive-layout {
    grid-template-columns: 1fr;
  }

  .archive-sidebar {
    position: static;
  }

  .archive-list {
    max-height: none;
    overflow: visible;
  }

  .archive-summary {
    flex-direction: column;
  }
}
</style>
