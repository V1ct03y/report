<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  detail?: string
}>()
</script>

<template>
  <article class="stat-card">
    <p class="stat-card__title">{{ title }}</p>
    <strong class="stat-card__value">{{ value }}</strong>
    <p v-if="detail" class="stat-card__detail">{{ detail }}</p>
  </article>
</template>

<style scoped>
.stat-card {
  padding: 1.2rem;
  border: 1px solid var(--line-soft);
  border-radius: 24px;
  background:
    linear-gradient(145deg, rgba(255, 250, 242, 0.92), rgba(249, 241, 228, 0.84)),
    var(--surface-0);
  box-shadow: var(--shadow-soft);
}

.stat-card__title {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.9rem;
}

.stat-card__value {
  display: block;
  margin-top: 0.55rem;
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: clamp(2rem, 3vw, 2.7rem);
}

.stat-card__detail {
  margin: 0.65rem 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}
</style>
