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
const drawerOpen = ref(false)

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

function navigateTo(path: string) {
  router.push(path)
  drawerOpen.value = false
}
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--authless': !showShell }">
    <template v-if="showShell">
      <!-- Mobile header with hamburger -->
      <header class="mobile-header">
        <button class="hamburger" type="button" @click="drawerOpen = true" aria-label="打开菜单">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <h1 class="mobile-header__title">电控匿名工作评分系统</h1>
      </header>

      <!-- Drawer overlay -->
      <div
        class="drawer-overlay"
        :class="{ 'drawer-overlay--visible': drawerOpen }"
        @click="drawerOpen = false"
      ></div>

      <!-- Sidebar / Drawer -->
      <aside class="sidebar" :class="{ 'sidebar--open': drawerOpen }">
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
            @click="navigateTo(item.to)"
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
          <div class="topbar__left">
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
/* Mobile header - only visible below 1024px */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  background: rgba(255, 248, 237, 0.96);
  border-bottom: 1px solid rgba(214, 191, 160, 0.45);
  backdrop-filter: blur(12px);
}

.mobile-header__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--text-strong);
}

/* Hamburger button */
.hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 8px;
  border: 1px solid rgba(213, 176, 132, 0.6);
  border-radius: 12px;
  background: rgba(255, 250, 243, 0.9);
  cursor: pointer;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--brand-strong);
  border-radius: 2px;
  transition: transform 0.2s ease;
}

/* Drawer overlay */
.drawer-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 199;
  background: rgba(46, 36, 26, 0.45);
  backdrop-filter: blur(2px);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.drawer-overlay--visible {
  opacity: 1;
}

.topbar__metric small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-soft);
}

.topbar__left {
  min-width: 0;
}

/* Sidebar drawer - only on mobile/tablet */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 200;
    width: 300px;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .mobile-header {
    display: flex;
  }

  .drawer-overlay {
    display: block;
  }

  .main-panel {
    padding-top: 4.5rem;
  }
}
</style>
