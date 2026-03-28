<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'

import StatusBadge from '../common/StatusBadge.vue'
import type { AdminCycleControl, AdminCycleRecord } from '../../types'

const props = defineProps<{
  control: AdminCycleControl
  busy?: boolean
}>()

const emit = defineEmits<{
  settle: [cycleId: number]
  publish: [cycleId: number]
  archive: [cycleId: number]
  reconcile: []
}>()

const nextActionCycle = computed(() => props.control.pendingPublicationCycle || props.control.currentCycle)

const nextAction = computed(() => {
  const cycle = nextActionCycle.value
  if (!cycle) {
    return {
      label: '同步周期状态',
      tone: 'muted' as const,
      action: 'reconcile' as const,
      description: '当前没有待处理周期，先手动同步一次，让系统按时间推进现有计划。'
    }
  }

  if (cycle.phase === 'settled') {
    return {
      label: '确认公示',
      tone: 'warning' as const,
      action: 'publish' as const,
      description: '本周结果已经结算完成，现在只差最后一步正式公示。'
    }
  }

  if (cycle.phase === 'closed') {
    return {
      label: '执行结算',
      tone: 'warning' as const,
      action: 'settle' as const,
      description: '当前周期已经截止，下一步应该先生成结算结果。'
    }
  }

  if (cycle.phase === 'open') {
    return {
      label: '手动结算',
      tone: 'warning' as const,
      action: 'settle' as const,
      description: '当前周期仍在进行中，但你可以提前结束并手动结算。'
    }
  }

  if (cycle.phase === 'published') {
    return {
      label: '归档公示',
      tone: 'success' as const,
      action: 'archive' as const,
      description: '这期结果已经完成公示，可以在确认后归入历史。'
    }
  }

  return {
    label: '同步周期状态',
    tone: 'muted' as const,
    action: 'reconcile' as const,
    description: '当前没有需要立即点击的动作，手动同步一次可以刷新所有周期阶段。'
  }
})

function formatWhen(value?: string | null) {
  if (!value) return '未设置'
  return dayjs(value).format('MM-DD HH:mm')
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

function handlePrimaryAction() {
  const cycle = nextActionCycle.value
  if (nextAction.value.action === 'publish' && cycle) emit('publish', cycle.id)
  if (nextAction.value.action === 'settle' && cycle) emit('settle', cycle.id)
  if (nextAction.value.action === 'archive' && cycle) emit('archive', cycle.id)
  if (nextAction.value.action === 'reconcile') emit('reconcile')
}
</script>

<template>
  <section class="control-panel">
    <article class="control-panel__hero surface-card">
      <div class="control-panel__copy">
        <StatusBadge :tone="nextAction.tone">
          {{ nextAction.label }}
        </StatusBadge>
        <h3>周期控制中心</h3>
        <p>{{ nextAction.description }}</p>
      </div>
      <div class="control-panel__actions">
        <button class="primary-button" type="button" :disabled="busy" @click="handlePrimaryAction">
          {{ busy ? '处理中…' : nextAction.label }}
        </button>
        <button class="secondary-button" type="button" :disabled="busy" @click="emit('reconcile')">
          手动同步
        </button>
      </div>
    </article>

    <div class="control-panel__grid">
      <article class="surface-card summary-card">
        <span class="summary-card__label">当前工作周期</span>
        <strong>{{ control.currentCycle?.name || '暂无' }}</strong>
        <StatusBadge tone="warning">{{ phaseLabel(control.currentCycle) }}</StatusBadge>
        <p>{{ formatWhen(control.currentCycle?.start_at) }} - {{ formatWhen(control.currentCycle?.end_at) }}</p>
      </article>

      <article class="surface-card summary-card">
        <span class="summary-card__label">待公示周期</span>
        <strong>{{ control.pendingPublicationCycle?.name || '暂无' }}</strong>
        <StatusBadge tone="warning">{{ phaseLabel(control.pendingPublicationCycle) }}</StatusBadge>
        <p>结算 {{ formatWhen(control.pendingPublicationCycle?.settled_at) }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.control-panel {
  display: grid;
  gap: 1rem;
}

.control-panel__hero {
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  padding: 1.25rem;
  align-items: center;
}

.control-panel__copy {
  display: grid;
  gap: 0.4rem;
  max-width: 48rem;
}

.control-panel__copy h3 {
  margin: 0;
}

.control-panel__copy p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.7;
}

.control-panel__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.control-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.summary-card {
  display: grid;
  gap: 0.5rem;
  padding: 1.1rem;
  min-height: 11rem;
  align-content: start;
}

.summary-card strong {
  font-family: var(--font-display);
  font-size: 1.65rem;
  line-height: 1.1;
}

.summary-card__label {
  color: var(--text-soft);
  font-size: 0.84rem;
}

.summary-card p {
  margin: 0;
  color: var(--text-soft);
}

@media (max-width: 900px) {
  .control-panel__hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .control-panel__actions {
    justify-content: flex-start;
  }

  .control-panel__grid {
    grid-template-columns: 1fr;
  }
}
</style>
