<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const { currentLeader, employeeList, leaderScores } = storeToRefs(appStore)

const currentScoreMap = computed(() =>
  currentLeader.value ? leaderScores.value[currentLeader.value.id] : {}
)

function updateScore(employeeId: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  appStore.updateLeaderScore(employeeId, value)
}

async function handleSubmit() {
  await appStore.submitLeaderScores()
}
</script>

<template>
  <div class="page-grid">
    <section class="surface-card hero-panel">
      <div>
        <StatusBadge tone="brand">组长评分录入</StatusBadge>
        <h3>{{ currentLeader?.name }} 的评分面板</h3>
        <p>组长评分总权重为 50%，按实际组长人数平均分配；结果公示页不会公开组长评分明细。</p>
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
  </div>
</template>

<style scoped>
.supervisor-table {
  width: 100%;
  border-collapse: collapse;
}

.supervisor-table th,
.supervisor-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid rgba(214, 191, 160, 0.55);
  text-align: left;
}

.supervisor-table__input {
  width: 7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(213, 176, 132, 0.8);
  border-radius: 16px;
  background: rgba(255, 253, 249, 0.96);
  color: var(--text-strong);
  font: inherit;
}
</style>
