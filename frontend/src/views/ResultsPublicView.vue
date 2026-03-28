<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import StatCard from '../components/common/StatCard.vue'
import TableSection from '../components/common/TableSection.vue'
import AnonymousMatrix from '../components/public/AnonymousMatrix.vue'
import MaskedSurface from '../components/public/MaskedSurface.vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const { cycleSummary, publicEmployees, publicMatrixRows, results, cycleOverview, currentAccount } = storeToRefs(appStore)

const isPrivileged = computed(() => currentAccount.value?.role === 'admin' || currentAccount.value?.role === 'leader')
const shouldMask = computed(() => !cycleSummary.value.isPublicVisible && !isPrivileged.value)

const maskedPlaceholderCount = computed(() => {
  if (!shouldMask.value) return 0
  return Math.max(publicEmployees.value.length, cycleSummary.value.employeeCount || 0, 4)
})

const maskedPlaceholderEmployees = computed(() => (
  Array.from({ length: maskedPlaceholderCount.value }, (_, index) => ({
    id: `masked-${index + 1}`,
    name: `待公示成员 ${index + 1}`,
    department: '待公示'
  }))
))

const matrixColumns = computed(() => {
  if (publicEmployees.value.length) return publicEmployees.value.map((item) => item.name)
  return maskedPlaceholderEmployees.value.map((item) => item.name)
})

const matrixRows = computed(() => {
  if (publicMatrixRows.value.length) return publicMatrixRows.value
  if (!shouldMask.value) return []

  return maskedPlaceholderEmployees.value.map((employee, index) => ({
    rowLabel: `匿名-${String(index + 1).padStart(2, '0')}`,
    employeeId: employee.id,
    values: maskedPlaceholderEmployees.value.map(() => null),
    valid: false
  }))
})

const rankingRows = computed(() => {
  if (results.value.length) return results.value
  if (!shouldMask.value) return []

  return maskedPlaceholderEmployees.value.map((employee, index) => ({
    employeeId: employee.id,
    name: employee.name,
    department: employee.department,
    peerAverage: 0,
    finalScore: 0,
    rank: index + 1,
    usedVotingRight: false,
    isBottomTwo: false
  }))
})

const publicationState = computed(() => {
  if (cycleSummary.value.isPublicVisible) return '已公示'
  return cycleOverview.value.publicCycle ? '当前未公示' : '未公示'
})

const nextCycleText = computed(() => {
  const cycle = cycleOverview.value.upcomingCycle
  if (!cycle) return '待生成'
  const label = cycle.week_number ? `第${cycle.week_number}周` : cycle.name
  if (!cycle.start_at || !cycle.end_at) return label
  return `${label}（${cycle.start_at} - ${cycle.end_at}）`
})

onMounted(() => {
  appStore.loadCycleOverview().catch(() => undefined)
  appStore.loadPublicResults().catch(() => undefined)
})
</script>

<template>
  <div class="page-grid">
    <section class="stats-grid">
      <StatCard title="当前周期" :value="cycleSummary.currentLabel" />
      <StatCard title="周期时间" :value="cycleSummary.currentPeriodText" />
      <StatCard title="下个周期" :value="nextCycleText" />
      <StatCard title="公开状态" :value="publicationState" />
    </section>

    <section class="surface-card hero-panel">
      <div>
        <StatusBadge :tone="cycleSummary.isPublicVisible ? 'success' : 'warning'">
          {{ cycleSummary.currentLabel }} {{ cycleSummary.isPublicVisible ? '结果已公开' : '结果待公开' }}
        </StatusBadge>
        <h3>当前公示周期</h3>
      </div>
      <div class="hero-panel__aside">
        <div class="hero-panel__metric">
          <span>参与员工</span>
          <strong>{{ cycleSummary.employeeCount }}</strong>
        </div>
        <div class="hero-panel__metric">
          <span>有效评分权</span>
          <strong>{{ cycleSummary.validVotingCount }}/{{ cycleSummary.employeeCount }}</strong>
        </div>
      </div>
    </section>

    <section class="results-layout">
      <TableSection
        class="results-layout__matrix"
        title="匿名评分矩阵"
        :description="cycleSummary.isPublicVisible ? '未完成评分权的成员整行显示 false。' : ''"
      >
        <MaskedSurface
          :masked="shouldMask"
          class="results-surface results-surface--matrix"
          title="评分矩阵暂未公开"
          description=""
        >
          <AnonymousMatrix
            class="results-matrix"
            :columns="matrixColumns"
            :rows="matrixRows"
          />
        </MaskedSurface>
      </TableSection>

      <TableSection
        class="results-layout__ranking"
        title="最终得分与排名"
        :description="cycleSummary.isPublicVisible ? '结算完成后展示真实排名与状态。' : ''"
      >
        <MaskedSurface
          :masked="shouldMask"
          class="results-surface results-surface--ranking"
          title="最终排名待公示"
          description=""
          compact
        >
          <table v-if="rankingRows.length" class="results-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>成员</th>
                <th>部门</th>
                <th>最终分</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in rankingRows" :key="item.employeeId">
                <td>#{{ item.rank }}</td>
                <td>{{ item.name }}</td>
                <td>{{ item.department }}</td>
                <td>{{ item.finalScore.toFixed(2) }}</td>
                <td>
                  <StatusBadge :tone="item.isBottomTwo ? 'danger' : item.usedVotingRight ? 'success' : 'muted'">
                    {{
                      item.isBottomTwo
                        ? '倒数两名'
                        : item.usedVotingRight
                          ? '评分权有效'
                          : '未使用评分权'
                    }}
                  </StatusBadge>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="results-empty">当前还没有可展示的结算排名。</div>
        </MaskedSurface>
      </TableSection>
    </section>
  </div>
</template>

<style scoped>
.results-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(340px, 1fr);
  gap: 1.1rem;
  align-items: start;
}

.results-layout__matrix,
.results-layout__ranking {
  min-width: 0;
}

.results-surface--matrix {
  min-height: clamp(14rem, 30vw, 20rem);
}

.results-surface--ranking {
  min-height: clamp(12rem, 26vw, 16rem);
}

.results-matrix {
  min-width: 100%;
}

.results-empty {
  padding: 1rem 0.75rem;
  color: var(--text-soft);
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
}

.results-table th {
  color: var(--text-soft);
  font-size: 0.83rem;
  text-transform: uppercase;
}

@media (max-width: 1200px) {
  .results-layout {
    grid-template-columns: 1fr;
  }
}
</style>
