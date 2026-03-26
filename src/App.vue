<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import StatusBadge from './components/common/StatusBadge.vue'
import { useAppStore } from './stores/app'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const { currentAccount, cycleSummary } = storeToRefs(appStore)
const now = ref(Date.now())

const navItems = computed(() => {
  if (!currentAccount.value) {
    return []
  }

  if (currentAccount.value.role === 'member') {
    return [
      { label: '成员评分', to: '/employee/rating' },
      { label: '提交状态', to: '/employee/status' },
      { label: '结果公示', to: '/public/results' },
      { label: '往期留存', to: '/archive/history' }
    ]
  }

  if (currentAccount.value.role === 'leader') {
    return [
      { label: '组长评分录入', to: '/supervisor/scoring' },
      { label: '结果公示', to: '/public/results' },
      { label: '往期留存', to: '/archive/history' }
    ]
  }

  return [
    { label: '后台仪表盘', to: '/admin/dashboard' },
    { label: '结果公示', to: '/public/results' },
    { label: '往期留存', to: '/archive/history' }
  ]
})

const showShell = computed(() => route.meta.shell !== false)

const countdownText = computed(() => {
  if (!cycleSummary.value.deadlineAt) return '未设置'

  const deadline = dayjs(cycleSummary.value.deadlineAt)
  if (!deadline.isValid()) return '未设置'

  const diff = deadline.valueOf() - now.value
  if (diff <= 0) return '已截止'

  const totalMilliseconds = diff
  const days = Math.floor(totalMilliseconds / 86400000)
  const hours = Math.floor((totalMilliseconds % 86400000) / 3600000)
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000)
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000)
  const milliseconds = totalMilliseconds % 1000

  const timeText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`

  if (days > 0) {
    return `${days}天 ${timeText}`
  }

  return timeText
})

let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 50)
})

onBeforeUnmount(() => {
  if (timer != null) {
    window.clearInterval(timer)
  }
})

function handleLogout() {
  appStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--authless': !showShell }">
    <template v-if="showShell">
      <aside class="sidebar">
        <div class="sidebar__brand">
          <p class="sidebar__eyebrow">Work Rating System</p>
          <h1>电控匿名工作评分系统</h1>
          <p class="sidebar__caption">围绕评分、结算、公示三条主流程展开的内部评分系统。</p>
        </div>

        <nav class="sidebar__nav">
          <button
            v-for="item in navItems"
            :key="item.to"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': route.path === item.to }"
            type="button"
            @click="router.push(item.to)"
          >
            {{ item.label }}
          </button>
        </nav>

        <div class="sidebar__footer">
          <div class="sidebar__user" v-if="currentAccount">
            <p class="sidebar__name">{{ currentAccount.displayName }}</p>
            <StatusBadge :tone="currentAccount.role === 'admin' ? 'warning' : 'brand'">
              {{ currentAccount.roleLabel }}
            </StatusBadge>
          </div>
          <button class="secondary-button sidebar__logout" type="button" @click="handleLogout">
            退出登录
          </button>
        </div>
      </aside>

      <main class="main-panel">
        <header class="topbar">
          <div>
            <p class="topbar__eyebrow">当前评分周期</p>
            <h2>{{ route.meta.title }}</h2>
            <p class="topbar__caption">{{ cycleSummary.currentLabel }} · {{ cycleSummary.currentPeriodText }}</p>
          </div>
          <div class="topbar__meta">
            <div class="topbar__metric">
              <span>当前阶段</span>
              <strong>{{ cycleSummary.stageLabel }}</strong>
            </div>
            <div class="topbar__metric">
              <span>截止时间</span>
              <strong>{{ countdownText }}</strong>
              <small>{{ cycleSummary.deadlineExact }}</small>
            </div>
          </div>
        </header>
        <RouterView />
      </main>
    </template>

    <main v-else class="authless-panel">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.topbar__metric small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-soft);
}
</style>
