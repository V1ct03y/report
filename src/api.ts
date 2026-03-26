const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'

let authToken = ''

export function setToken(token: string) {
  authToken = token
}

export function clearToken() {
  authToken = ''
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || '请求失败')
  }
  return data
}

export const api = {
  login(payload: { username: string; password: string }) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
  },
  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) })
  },
  getEmployeeCurrentCycle() {
    return request('/employee/current-cycle')
  },
  submitEmployeeScores(scores: Array<{ targetUserId: number; score: number | null }>) {
    return request('/employee/scores', {
      method: 'POST',
      body: JSON.stringify({ scores })
    })
  },
  getPublicResults() {
    return request('/employee/public-results')
  },
  getAdminDashboard() {
    return request('/admin/dashboard')
  },
  getLeaderCurrentCycle() {
    return request('/admin/leader/current-cycle')
  },
  submitManagerScores(scores: Array<{ targetUserId: number; score: number }>) {
    return request('/admin/manager-scores', {
      method: 'POST',
      body: JSON.stringify({ scores })
    })
  },
  settle(cycleId?: number) {
    return request('/admin/settle', {
      method: 'POST',
      body: JSON.stringify({ cycleId })
    })
  },
  settleAutomatic() {
    return request('/admin/settle/automatic', { method: 'POST' })
  },
  getAdminResults() {
    return request('/admin/results')
  },
  createMember(payload: { username: string; fullName: string; password: string }) {
    return request('/admin/members', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  updateUserRole(id: number, role: 'admin' | 'leader' | 'member') {
    return request(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    })
  },
  updateUserActive(id: number, isActive: boolean) {
    return request(`/admin/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    })
  },
  updateUserParticipation(id: number, isParticipant: boolean) {
    return request(`/admin/users/${id}/participation`, {
      method: 'PATCH',
      body: JSON.stringify({ isParticipant })
    })
  },
  deactivateSelf() {
    return request('/admin/self/deactivate', { method: 'POST' })
  },
  getCurrentCycleMeta() {
    return request('/cycles/current')
  },
  getCycleHistory() {
    return request('/cycles/history')
  },
  getCycleOverview() {
    return request('/cycles/overview')
  },
  getCurrentPublicCycle() {
    return request('/cycles/current/public')
  },
  getCurrentWorkCycle() {
    return request('/cycles/current/work')
  },
  getCycleResults(id: number) {
    return request(`/cycles/${id}/results`)
  }
}
