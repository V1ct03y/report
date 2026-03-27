<script setup lang="ts">
withDefaults(
  defineProps<{
    masked?: boolean
    title: string
    description: string
    compact?: boolean
  }>(),
  {
    masked: false,
    compact: false
  }
)
</script>

<template>
  <div class="masked-surface" :class="{ 'masked-surface--compact': compact }">
    <slot />
    <div v-if="masked" class="masked-surface__veil">
      <div class="masked-surface__copy">
        <strong>{{ title }}</strong>
        <p>{{ description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.masked-surface {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  isolation: isolate;
}

.masked-surface--compact {
  border-radius: 20px;
}

.masked-surface__veil {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.5rem;
  border-radius: inherit;
  overflow: hidden;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.2), rgba(248, 236, 220, 0.24)),
    linear-gradient(180deg, rgba(255, 251, 245, 0.12), rgba(255, 248, 240, 0.18));
  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.62),
    inset 0 0 0 1px rgba(255, 255, 255, 0.24);
}

.masked-surface__veil::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06) 38%, rgba(255, 255, 255, 0.14)),
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.34), transparent 38%),
    radial-gradient(circle at bottom right, rgba(244, 222, 192, 0.18), transparent 30%);
  pointer-events: none;
}

.masked-surface__copy {
  position: relative;
  z-index: 1;
  max-width: 28rem;
  padding: 1.25rem 1.45rem;
  border-radius: 24px;
  background: rgba(255, 253, 250, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.52);
  box-shadow:
    0 12px 36px rgba(118, 92, 55, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.masked-surface__copy strong {
  display: block;
  font-size: 1.05rem;
}

.masked-surface__copy p {
  margin: 0.55rem 0 0;
  color: var(--text-soft);
  line-height: 1.65;
}

.masked-surface:has(.masked-surface__veil) {
  user-select: none;
}

.masked-surface:has(.masked-surface__veil) :deep(table),
.masked-surface:has(.masked-surface__veil) :deep(.matrix) {
  opacity: 0.52;
  filter: saturate(0.94);
  pointer-events: none;
}
</style>
