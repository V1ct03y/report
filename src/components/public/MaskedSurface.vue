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
  background:
    linear-gradient(135deg, rgba(255, 251, 245, 0.78), rgba(244, 233, 218, 0.7)),
    rgba(255, 250, 244, 0.6);
  backdrop-filter: blur(26px) saturate(1.22);
  -webkit-backdrop-filter: blur(26px) saturate(1.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.masked-surface__veil::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.02)),
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.26), transparent 36%);
  pointer-events: none;
}

.masked-surface__copy {
  position: relative;
  z-index: 1;
  max-width: 28rem;
  padding: 1.25rem 1.45rem;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.58);
  box-shadow: 0 12px 36px rgba(118, 92, 55, 0.12);
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
  filter: blur(5px) saturate(0.92);
  transform: scale(1.01);
  pointer-events: none;
}
</style>
