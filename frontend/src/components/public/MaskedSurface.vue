<script setup lang="ts">
withDefaults(
  defineProps<{
    masked?: boolean
    title: string
    description?: string
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
        <p v-if="description">{{ description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.masked-surface {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  isolation: isolate;
}

.masked-surface--compact {
  border-radius: var(--radius-md);
}

.masked-surface:has(.masked-surface__veil) {
  min-height: 11rem;
  user-select: none;
}

.masked-surface--compact:has(.masked-surface__veil) {
  min-height: 9.5rem;
}

.masked-surface__veil {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(1rem, 2vw, 1.5rem);
  border-radius: inherit;
  overflow: hidden;
  background:
    linear-gradient(140deg, rgba(252, 248, 239, 0.22), rgba(232, 225, 213, 0.18)),
    linear-gradient(180deg, rgba(252, 248, 239, 0.08), rgba(252, 248, 239, 0.14));
  backdrop-filter: blur(24px) saturate(1.02);
  -webkit-backdrop-filter: blur(24px) saturate(1.02);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.masked-surface__veil::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.03) 38%, rgba(255, 255, 255, 0.08)),
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.18), transparent 38%),
    radial-gradient(circle at bottom right, rgba(232, 225, 213, 0.12), transparent 30%);
  pointer-events: none;
}

.masked-surface__copy {
  position: relative;
  z-index: 1;
  width: min(100%, 28rem);
  max-width: 28rem;
  padding: 1.25rem 1.45rem;
  border-radius: var(--radius-lg);
  background: rgba(252, 248, 239, 0.28);
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
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

.masked-surface:has(.masked-surface__veil) :deep(table),
.masked-surface:has(.masked-surface__veil) :deep(.matrix) {
  opacity: 0.38;
  filter: saturate(0.9);
  pointer-events: none;
}
</style>
