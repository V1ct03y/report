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
const { cycleSummary, publicEmployees, publicMatrixRows, results, cycleOverview } = storeToRefs(appStore)

const rankingRows = computed(() => {
  if (results.value.length) return results.value
  return publicEmployees.value.map((employee, index) => ({
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
      <StatCard title="当前周期" :value="cycleSummary.currentLabel" detail="公示视图始终绑定当前展示周期。" />
      <StatCard title="周期时间" :value="cycleSummary.currentPeriodText" detail="展示开始与结束时间，便于核对当前周次。" />
      <StatCard title="下个周期" :value="nextCycleText" detail="展示下一评分周期，替代倒计时卡片。" />
      <StatCard title="公开状态" :value="publicationState" detail="已公示周期展示真实结果，未公示周期只保留结构。" />
    </section>

    <section class="surface-card hero-panel">
      <div>
        <StatusBadge :tone="cycleSummary.isPublicVisible ? 'success' : 'warning'">
          {{ cycleSummary.currentLabel }} {{ cycleSummary.isPublicVisible ? '结果已公开' : '结果待公开' }}
        </StatusBadge>
        <h3>当前公示周期</h3>
        <p>
          当前页面始终跟随当前展示阶段；若本期仍处于 work 或待公示阶段，则只保留完整骨架并遮罩数据。
        </p>
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

    <TableSection
      title="匿名评分矩阵"
      :description="cycleSummary.isPublicVisible
        ? '已公示后展示匿名评分矩阵；未完成评分权的成员整行显示 false。'
        : '未公示前保留完整矩阵骨架，并用 macOS 风格雾化玻璃遮蔽全部内容。'"
    >
      <MaskedSurface
        :masked="!cycleSummary.isPublicVisible"
        title="评分矩阵暂未公开"
        description="当前仅保留原始矩阵骨架，实际分数将在结算完成并公示后揭示。"
      >
        <AnonymousMatrix :columns="publicEmployees.map((item) => item.name)" :rows="publicMatrixRows" />
      </MaskedSurface>
    </TableSection>

    <TableSection
      title="最终得分与排名"
      :description="cycleSummary.isPublicVisible
        ? '结算完成后展示真实排名与状态。'
        : '未公示前保留同尺寸表格占位，并用 macOS 风格雾化玻璃遮蔽最终得分与排名。'"
    >
      <MaskedSurface
        :masked="!cycleSummary.isPublicVisible"
        title="最终排名待公示"
        description="表格维持同样的行列结构，只在正式公示时解除遮罩并显示分数。"
        compact
      >
        <table class="results-table">
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
              <td>{{ cycleSummary.isPublicVisible ? `#${item.rank}` : '—' }}</td>
              <td>{{ item.name }}</td>
              <td>{{ item.department }}</td>
              <td>{{ cycleSummary.isPublicVisible ? item.finalScore.toFixed(2) : '—' }}</td>
              <td>
                <StatusBadge :tone="cycleSummary.isPublicVisible && item.isBottomTwo ? 'danger' : item.usedVotingRight ? 'success' : 'muted'">
                  {{
                    cycleSummary.isPublicVisible
                      ? item.isBottomTwo
                        ? '倒数两名'
                        : item.usedVotingRight
                          ? '评分权有效'
                          : '未使用评分权'
                      : '待公示'
                  }}
                </StatusBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </MaskedSurface>
    </TableSection>
  </div>
</template>

<style scoped>
.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid rgba(214, 191, 160, 0.55);
  text-align: left;
}

.results-table th {
  color: var(--text-soft);
  font-size: 0.83rem;
  text-transform: uppercase;
}
</style>
