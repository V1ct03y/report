<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'brand' | 'success' | 'warning' | 'muted' | 'danger'
  }>(),
  {
    tone: 'muted'
  }
)
</script>

<template>
  <span class="status-badge" :class="`status-badge--${tone}`">
    <slot />
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.status-badge--brand {
  color: var(--brand-strong);
  background: rgba(224, 124, 56, 0.14);
}

.status-badge--success {
  color: #1c5c44;
  background: rgba(47, 123, 89, 0.15);
}

.status-badge--warning {
  color: #8a5418;
  background: rgba(236, 175, 86, 0.2);
}

.status-badge--muted {
  color: var(--text-soft);
  background: rgba(114, 96, 77, 0.1);
}

.status-badge--danger {
  color: #8a3b2a;
  background: rgba(192, 92, 65, 0.16);
}
</style>
