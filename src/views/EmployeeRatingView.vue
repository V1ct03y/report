<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import StatusBadge from '../components/common/StatusBadge.vue'
import TableSection from '../components/common/TableSection.vue'
import ScoreTable from '../components/employee/ScoreTable.vue'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()
const { currentEmployee, employeeList, employeeScores, employeeDraftComplete, submissions } =
  storeToRefs(appStore)

const draftScores = computed({
  get: () => (currentEmployee.value ? employeeScores.value[currentEmployee.value.id] : {}),
  set: (value) => appStore.updateEmployeeScores(value)
})

const submissionState = computed(() => {
  if (!currentEmployee.value) {
    return null
  }
  return submissions.value[currentEmployee.value.id]
})

function handleSubmit() {
  appStore.submitEmployeeScores()
  router.push('/employee/status')
}
</script>

<template>
  <div class="page-grid">
    <section class="surface-card hero-panel">
      <div>
        <StatusBadge :tone="employeeDraftComplete ? 'success' : 'warning'">
          {{ employeeDraftComplete ? '已满足全员评分条件' : '尚未完成全员评分' }}
        </StatusBadge>
        <h3>{{ currentEmployee?.name }} 的评分任务</h3>
        <p>
          本期要求你对全部参与成员含自己评分。若有任意一人未评分，则视为未使用评分权：
          自评分按 0 计入本人最终成绩，给他人的评分全部无效，但你仍参与被评分和最终排名。
        </p>
      </div>
      <div class="hero-panel__aside">
        <div class="hero-panel__metric">
          <span>提交状态</span>
          <strong>{{ submissionState?.submittedAt ? '已提交' : '待提交' }}</strong>
        </div>
        <div class="hero-panel__metric">
          <span>评分权状态</span>
          <strong>{{ employeeDraftComplete ? '有效' : '未生效' }}</strong>
        </div>
      </div>
    </section>

    <TableSection
      title="成员评分表"
      description="支持成员对全员逐一录入分数，桌面端优先，强调完成度与规则提示。"
    >
      <template #actions>
        <button class="primary-button" type="button" @click="handleSubmit">
          {{ employeeDraftComplete ? '提交评分' : '以未完成状态提交' }}
        </button>
      </template>

      <ScoreTable
        v-model="draftScores"
        :employees="employeeList"
        :current-employee-id="currentEmployee?.id"
        :show-department="true"
      />
    </TableSection>
  </div>
</template>
