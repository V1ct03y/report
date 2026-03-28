<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="table-section">
    <header class="table-section__header">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <div class="table-section__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="table-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.table-section {
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background: rgba(252, 248, 239, 0.94);
  overflow: hidden;
}

.table-section__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem 1.35rem;
  border-bottom: 1px solid var(--line-soft);
}

.table-section__header h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
}

.table-section__header p {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
}

.table-section__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.table-section__body {
  padding: 1rem 1.35rem 1.35rem;
}
</style>
