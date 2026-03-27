<script setup lang="ts">
import dayjs from 'dayjs'

import StatusBadge from '../common/StatusBadge.vue'
import type { AdminCycleControl, AdminCycleRecord } from '../../types'

defineProps<{
  control: AdminCycleControl
}>()

function formatWhen(value?: string | null) {
  if (!value) return '未设置'
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

function phaseTone(phase?: string) {
  if (phase === 'published') return 'success'
  if (phase === 'settled' || phase === 'closed') return 'warning'
  if (phase === 'archived') return 'muted'
  return 'muted'
}

function phaseLabel(cycle: AdminCycleRecord | null) {
  if (!cycle) return '未配置'
  const map: Record<string, string> = {
    planned: '待开始',
    open: '进行中',
    closed: '待结算',
    settled: '待公示',
    published: '公示中',
    archived: '已归档'
  }
  return map[cycle.phase] || cycle.phase
}
</script>

<template>
  <div class="timeline-list">
    <article v-if="control.currentCycle" class="timeline-item surface-card">
      <div>
        <span class="timeline-item__label">当前工作周期</span>
        <strong>{{ control.currentCycle.name }}</strong>
        <p>{{ formatWhen(control.currentCycle.start_at) }} - {{ formatWhen(control.currentCycle.end_at) }}</p>
      </div>
      <StatusBadge :tone="phaseTone(control.currentCycle.phase)">{{ phaseLabel(control.currentCycle) }}</StatusBadge>
    </article>

    <article v-if="control.upcomingCycle" class="timeline-item surface-card">
      <div>
        <span class="timeline-item__label">下一周期</span>
        <strong>{{ control.upcomingCycle.name }}</strong>
        <p>{{ formatWhen(control.upcomingCycle.start_at) }} - {{ formatWhen(control.upcomingCycle.end_at) }}</p>
      </div>
      <StatusBadge :tone="phaseTone(control.upcomingCycle.phase)">{{ phaseLabel(control.upcomingCycle) }}</StatusBadge>
    </article>

    <article v-if="control.publishedCycle" class="timeline-item surface-card">
      <div>
        <span class="timeline-item__label">当前公示周期</span>
        <strong>{{ control.publishedCycle.name }}</strong>
        <p>公示于 {{ formatWhen(control.publishedCycle.published_at) }}</p>
      </div>
      <StatusBadge :tone="phaseTone(control.publishedCycle.phase)">{{ phaseLabel(control.publishedCycle) }}</StatusBadge>
    </article>
  </div>
</template>

<style scoped>
.timeline-list {
  display: grid;
  gap: 0.8rem;
}

.timeline-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.timeline-item__label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--text-soft);
  font-size: 0.84rem;
}

.timeline-item p {
  margin: 0.35rem 0 0;
  color: var(--text-soft);
}

@media (max-width: 767px) {
  .timeline-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
