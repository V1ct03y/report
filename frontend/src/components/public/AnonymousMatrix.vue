<script setup lang="ts">
defineProps<{
  columns: string[]
  rows: Array<{
    rowLabel: string
    values: Array<number | false | null>
  }>
}>()
</script>

<template>
  <div class="matrix">
    <table>
      <thead>
        <tr>
          <th>匿名行</th>
          <th v-for="column in columns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.rowLabel">
          <td class="matrix__label">{{ row.rowLabel }}</td>
          <td
            v-for="(value, index) in row.values"
            :key="`${row.rowLabel}-${index}`"
            :class="{ 'matrix__cell--invalid': value === false }"
          >
            {{ value === false ? 'false' : value == null ? '—' : value }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.matrix {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  text-align: center;
  white-space: nowrap;
}

th:first-child,
td:first-child {
  text-align: left;
}

th {
  color: var(--text-soft);
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

.matrix__label {
  color: var(--text-strong);
  font-weight: 700;
}

.matrix td {
  min-width: 5.4rem;
}

.matrix__cell--invalid {
  color: var(--brand-strong);
  background: rgba(217, 119, 87, 0.1);
}
</style>
