<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import AnonymousMatrix from '../components/public/AnonymousMatrix.vue'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()
const { currentLeader, employeeList, leaderScores, leaderSubmissions, publicEmployees, publicMatrixRows, results, cycleSummary, cycleOverview } = storeToRefs(appStore)

const currentScoreMap = computed(() =>
  currentLeader.value ? leaderScores.value[currentLeader.value.id] : {}
)

const currentSubmission = computed(() =>
  currentLeader.value ? leaderSubmissions.value[currentLeader.value.id] : null
)

const scoreReady = computed(() =>
  employeeList.value.length > 0 && employeeList.value.every((employee) => typeof currentScoreMap.value[employee.id] === 'number')
)

const hasScoringCycle = computed(() => Boolean(cycleOverview.value.workCycle))
const currentPublicLabel = computed(() => cycleOverview.value.publicCycle?.name || cycleOverview.value.displayCycle?.name || '当前周期')
const nextWorkLabel = computed(() => cycleOverview.value.upcomingCycle?.name || '下一个评分周期')

const matrixColumns = computed(() => {
  if (publicEmployees.value.length) return publicEmployees.value.map((item) => item.name)
  return employeeList.value.map((item) => item.name)
})

const rankingRows = computed(() => results.value)

function updateScore(employeeId: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  appStore.updateLeaderScore(employeeId, value)
}

async function handleSubmit() {
  if (!hasScoringCycle.value) return
  await appStore.submitLeaderScores()
  router.push('/supervisor/status')
}
</script>

<template>
  <div class="page-grid">
    <section v-if="!hasScoringCycle" class="surface-card status-panel">
      <StatusBadge tone="warning">当前不是评分阶段</StatusBadge>
      <h3>组长评分已关闭</h3>
      <p>{{ currentPublicLabel }} 正在公示中，当前页面不再接受组长评分。下一次可录入评分的周期是 {{ nextWorkLabel }}。</p>
      <div class="status-panel__actions">
        <button class="secondary-button" type="button" @click="router.push('/public/results')">查看结果公示</button>
        <button class="primary-button" type="button" @click="router.push('/supervisor/status')">查看组长评分状态</button>
      </div>
    </section>

    <template v-else>
    <section class="surface-card hero-panel">
      <div>
        <StatusBadge :tone="scoreReady ? 'success' : 'warning'">{{ scoreReady ? '已完成全员组长评分' : '尚未完成全员组长评分' }}</StatusBadge>
        <h3>{{ currentLeader?.name }} 的评分面板</h3>
        <p>组长评分总权重为 60%，按实际组长人数平均分配；结果公示页不会公开组长评分明细。</p>
      </div>
      <div class="hero-panel__aside">
        <div class="hero-panel__metric">
          <span>保存状态</span>
          <strong>{{ currentSubmission?.submittedAt ? '已保存' : '待保存' }}</strong>
        </div>
        <div class="hero-panel__metric">
          <span>生效状态</span>
          <strong>
            {{
              currentSubmission?.isComplete
                ? '已全部生效'
                : currentSubmission?.isEffective
                  ? '部分生效'
                  : '未生效'
            }}
          </strong>
        </div>
      </div>
    </section>

    <TableSection title="组长评分表" description="录入本期参与成员评分，配合管理员完成本期结算。">
      <template #actions>
        <button class="primary-button" type="button" @click="handleSubmit">保存组长评分</button>
      </template>
      <table class="supervisor-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>部门</th>
            <th>岗位</th>
            <th>评分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="employee in employeeList" :key="employee.id">
            <td>{{ employee.name }}</td>
            <td>{{ employee.department }}</td>
            <td>{{ employee.title }}</td>
            <td>
              <input
                class="supervisor-table__input"
                :value="currentScoreMap[employee.id]"
                type="number"
                min="0"
                max="100"
                @input="updateScore(employee.id, $event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </TableSection>

    <TableSection
      title="匿名评分矩阵"
      description="组长视角实时显示当前周期矩阵；未取得评分权的成员整行显示 false。"
    >
      <AnonymousMatrix
        class="results-matrix"
        :columns="matrixColumns"
        :rows="publicMatrixRows"
      />
    </TableSection>

    <TableSection
      title="实时排名"
      description="按当前成员提交与组长评分实时计算，便于在正式结算前校验结果走势。"
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
      <div v-else class="results-empty">
        {{ cycleSummary.isPublicVisible ? '当前还没有可展示的排名。' : '当前周期还没有足够数据生成实时排名。' }}
      </div>
    </TableSection>
    </template>
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

.status-panel__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.2rem;
}

.supervisor-table {
  width: 100%;
  border-collapse: collapse;
}

.supervisor-table th,
.supervisor-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
}

.supervisor-table__input {
  width: 7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: rgba(252, 248, 239, 0.96);
  color: var(--text-strong);
  font: inherit;
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
</style>
