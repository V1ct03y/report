<script setup lang="ts">
import { computed } from 'vue'

import StatusBadge from '../common/StatusBadge.vue'
import type { Employee, ScoreMap } from '../../types'

const props = defineProps<{
  employees: Employee[]
  modelValue: ScoreMap
  currentEmployeeId?: string
  readonly?: boolean
  showDepartment?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScoreMap]
}>()

const completion = computed(() => {
  const total = props.employees.length
  const done = Object.values(props.modelValue).filter((score) => typeof score === 'number').length
  return { done, total }
})

function updateScore(employeeId: string, rawValue: string) {
  const nextValue = rawValue === '' ? null : Number(rawValue)
  emit('update:modelValue', { ...props.modelValue, [employeeId]: nextValue })
}
</script>

<template>
  <div class="score-table">
    <div class="score-table__summary">
      <StatusBadge tone="brand">已填写 {{ completion.done }}/{{ completion.total }}</StatusBadge>
      <p>每位成员必须对全部参与成员含自己完成评分，未完成则视为未使用评分权。</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>成员</th>
          <th v-if="showDepartment">部门</th>
          <th>岗位</th>
          <th>评分</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="employee in employees" :key="employee.id">
          <td>
            <div class="score-table__person">
              <strong>{{ employee.name }}</strong>
              <StatusBadge v-if="employee.id === currentEmployeeId" tone="warning">本人</StatusBadge>
            </div>
          </td>
          <td v-if="showDepartment">{{ employee.department }}</td>
          <td>{{ employee.title }}</td>
          <td>
            <label class="score-table__control">
              <input
                :value="modelValue[employee.id] ?? ''"
                :disabled="readonly"
                type="number"
                min="0"
                max="100"
                placeholder="0-100"
                @input="updateScore(employee.id, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.score-table {
  display: grid;
  gap: 1rem;
}

.score-table__summary {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.9rem 1rem;
  border-radius: 20px;
  background: rgba(244, 174, 93, 0.11);
}

.score-table__summary p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid rgba(214, 191, 160, 0.55);
  text-align: left;
}

th {
  color: var(--text-soft);
  font-size: 0.83rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.score-table__person {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.score-table__control input {
  width: 7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(213, 176, 132, 0.8);
  border-radius: 16px;
  background: rgba(255, 253, 249, 0.96);
  color: var(--text-strong);
  font: inherit;
}
</style>
