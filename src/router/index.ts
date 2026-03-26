import { createRouter, createWebHistory } from 'vue-router'

import { useAppStore } from '../stores/app'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { shell: false, title: '登录' }
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/FirstPasswordResetView.vue'),
      meta: { title: '首次修改密码', requiresAuth: true }
    },
    {
      path: '/employee/rating',
      name: 'employee-rating',
      component: () => import('../views/EmployeeRatingView.vue'),
      meta: { title: '成员评分页', requiresAuth: true, role: 'member' }
    },
    {
      path: '/employee/status',
      name: 'employee-status',
      component: () => import('../views/SubmissionStatusView.vue'),
      meta: { title: '提交状态', requiresAuth: true, role: 'member' }
    },
    {
      path: '/public/results',
      name: 'public-results',
      component: () => import('../views/ResultsPublicView.vue'),
      meta: { title: '结果公示页', requiresAuth: true }
    },
    {
      path: '/archive/history',
      name: 'archive-history',
      component: () => import('../views/HistoryArchiveView.vue'),
      meta: { title: '往期留存', requiresAuth: true }
    },
    {
      path: '/admin/dashboard',
      name: 'admin-dashboard',
      component: () => import('../views/AdminDashboardView.vue'),
      meta: { title: '后台仪表盘', requiresAuth: true, role: 'admin' }
    },
    {
      path: '/supervisor/scoring',
      name: 'supervisor-scoring',
      component: () => import('../views/SupervisorScoringView.vue'),
      meta: { title: '组长评分录入页', requiresAuth: true, role: 'leader' }
    }
  ]
})

router.beforeEach((to) => {
  const appStore = useAppStore()
  const account = appStore.currentAccount

  if (to.meta.requiresAuth && !account) {
    return '/login'
  }

  if (account?.firstLogin && to.path !== '/reset-password') {
    return '/reset-password'
  }

  if (!account?.firstLogin && to.path === '/reset-password') {
    if (account?.role === 'member') {
      return '/employee/rating'
    }

    if (account?.role === 'leader') {
      return '/supervisor/scoring'
    }

    if (account?.role === 'admin') {
      return '/admin/dashboard'
    }
  }

  if (to.meta.role && account?.role !== to.meta.role) {
    return '/public/results'
  }

  return true
})

export default router
