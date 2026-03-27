import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'

import { api, clearToken, setToken } from '../api'
import type {
  Account,
  CycleOverview,
  CycleRecord,
  CycleSummary,
  Employee,
  EmployeeResult,
  EmployeeSubmission,
  Leader,
  MemberRecord,
  PublicMatrixRow,
  Role,
  ScoreMap,
  SchedulingConfig
} from '../types'

function emptyOverview(): CycleOverview {
  return {
    publicCycle: null,
    workCycle: null,
    displayCycle: null,
    upcomingCycle: null,
    history: []
  }
}

function mapRole(role: string): Role {
  if (role === 'employee') return 'member'
  if (role === 'manager') return 'leader'
  if (role === 'admin' || role === 'leader' || role === 'member') return role
  return 'member'
}

function mapRoleLabel(role: Role) {
  if (role === 'leader') return '组长'
  if (role === 'admin') return '后台管理员'
  return '成员'
}

function normalizeCycle(raw: any): CycleRecord | null {
  if (!raw) return null
  return {
    id: Number(raw.id),
    name: String(raw.name || ''),
    week_number: raw.week_number == null ? null : Number(raw.week_number),
    start_at: raw.start_at || null,
    end_at: raw.end_at || null,
    status: raw.status,
    settled_at: raw.settled_at || null,
    settle_mode: raw.settle_mode || null,
    public_at: raw.public_at || null,
    is_archived: Number(raw.is_archived || 0)
  }
}

function normalizeOverview(raw: any): CycleOverview {
  return {
    publicCycle: normalizeCycle(raw?.publicCycle),
    workCycle: normalizeCycle(raw?.workCycle),
    displayCycle: normalizeCycle(raw?.displayCycle),
    upcomingCycle: normalizeCycle(raw?.upcomingCycle),
    history: Array.isArray(raw?.history) ? raw.history.map((item: any) => normalizeCycle(item)).filter(Boolean) as CycleRecord[] : []
  }
}

function mapPeople(raw: Array<any>): Employee[] {
  return raw.map((item) => ({
    id: String(item.id),
    name: String(item.full_name || item.name || ''),
    title: item.role === 'leader' ? '组长' : '成员',
    department: '电控组'
  }))
}

function cycleLabel(cycle: CycleRecord | null) {
  if (!cycle) return '未设置周期'
  if (cycle.week_number != null) return `第${cycle.week_number}周`
  return cycle.name || '未设置周期'
}

function cyclePeriodText(cycle: CycleRecord | null) {
  if (!cycle) return '暂无周期时间'
  if (!cycle.start_at || !cycle.end_at) return '周期时间未设置'
  return `${dayjs(cycle.start_at).format('MM月DD日 HH:mm')} - ${dayjs(cycle.end_at).format('MM月DD日 HH:mm')}`
}

function formatDeadline(raw?: string | null) {
  if (!raw) return '未设置截止时间'
  return dayjs(raw).format('YYYY-MM-DD HH:mm:ss.SSS')
}

function stageLabel(overview: CycleOverview) {
  if (overview.publicCycle && overview.displayCycle?.id === overview.publicCycle.id) {
    return `${cycleLabel(overview.publicCycle)}公示`
  }
  if (overview.workCycle) {
    return `${cycleLabel(overview.workCycle)}评分`
  }
  return '未设置阶段'
}

function stageDeadline(overview: CycleOverview) {
  if (overview.publicCycle && overview.displayCycle?.id === overview.publicCycle.id) {
    return formatDeadline(overview.upcomingCycle?.start_at || overview.publicCycle.end_at)
  }
  return formatDeadline(overview.workCycle?.end_at || overview.displayCycle?.end_at)
}

function stageDeadlineAt(overview: CycleOverview) {
  if (overview.publicCycle && overview.displayCycle?.id === overview.publicCycle.id) {
    return overview.upcomingCycle?.start_at || overview.publicCycle.end_at || null
  }
  return overview.workCycle?.end_at || overview.displayCycle?.end_at || null
}

function placeholderMatrixRows(rowCount: number, columnCount: number) {
  return Array.from({ length: rowCount }, (_, index) => ({
    rowLabel: `匿名-${String(index + 1).padStart(2, '0')}`,
    employeeId: `placeholder-${index + 1}`,
    values: Array.from({ length: columnCount }, () => null),
    valid: false
  }))
}

export const useAppStore = defineStore('app', () => {
  const token = ref('')
  const currentAccount = ref<Account | null>(null)
  const accountList = ref<Account[]>([])
  const employeeList = ref<Employee[]>([])
  const publicEmployees = ref<Employee[]>([])
  const leaderList = ref<Leader[]>([])
  const employeeScores = ref<Record<string, ScoreMap>>({})
  const leaderScores = ref<Record<string, Record<string, number>>>({})
  const submissions = ref<Record<string, EmployeeSubmission>>({})
  const results = ref<EmployeeResult[]>([])
  const publicMatrixRows = ref<PublicMatrixRow[]>([])
  const cycleSummary = ref<CycleSummary>({
    employeeCount: 0,
    submittedCount: 0,
    validVotingCount: 0,
    pendingCount: 0,
    averageScore: 0,
    bottomTwoNames: '-',
    isPublicVisible: false,
    currentLabel: '未设置周期',
    currentPeriodText: '暂无周期时间',
    publicLabel: '未设置周期',
    workLabel: '未设置周期',
    stageLabel: '未设置阶段',
    deadlineExact: '未设置截止时间',
    deadlineAt: null
  })
  const cycle = ref<CycleRecord | null>(null)
  const publicCycle = ref<CycleRecord | null>(null)
  const dashboard = ref<any>(null)
  const members = ref<MemberRecord[]>([])
  const users = ref<MemberRecord[]>([])
  const cycleOverview = ref<CycleOverview>(emptyOverview())
  const historyCycles = ref<CycleRecord[]>([])
  const schedulingConfig = ref<SchedulingConfig | null>(null)
  const allCycles = ref<CycleRecord[]>([])

  const currentEmployee = computed(() => {
    const employeeId = currentAccount.value?.linkedEmployeeId
    return employeeList.value.find((employee) => employee.id === employeeId) ?? null
  })

  const currentLeader = computed(() => {
    const leaderId = currentAccount.value?.linkedLeaderId
    return leaderList.value.find((leader) => leader.id === leaderId) ?? null
  })

  const employeeDraftComplete = computed(() => {
    if (!currentEmployee.value) return false
    const draft = employeeScores.value[currentEmployee.value.id] || {}
    return employeeList.value.length > 0 && employeeList.value.every((employee) => typeof draft[employee.id] === 'number')
  })

  const employeeAlreadySubmitted = computed(() => {
    if (!currentEmployee.value) return false
    return Boolean(submissions.value[currentEmployee.value.id]?.submittedAt)
  })

  function syncOverview(raw: any) {
    const overview = normalizeOverview(raw)
    cycleOverview.value = overview
    cycle.value = overview.workCycle
    publicCycle.value = overview.publicCycle
    historyCycles.value = overview.history
  }

  function rebuildSummary() {
    const isPublicVisible = Boolean(
      cycleOverview.value.publicCycle &&
      cycleOverview.value.displayCycle?.id === cycleOverview.value.publicCycle.id
    )
    const submissionList = Object.values(submissions.value)
    const rankedResults = results.value.filter((item) => item.rank > 0)
    const employeeCount = isPublicVisible
      ? (publicEmployees.value.length || rankedResults.length)
      : (employeeList.value.length || members.value.filter((item) => item.role === 'member' && (item.is_participant === 1 || item.is_participant == null)).length)
    const submittedCount = submissionList.filter((item) => item?.submittedAt).length
    const validVotingCount = isPublicVisible
      ? rankedResults.filter((item) => item.usedVotingRight).length
      : submissionList.filter((item) => item?.usedVotingRight).length
    const pendingCount = Math.max(employeeCount - submittedCount, 0)
    const averageScore = isPublicVisible && rankedResults.length
      ? Number((rankedResults.reduce((sum, item) => sum + item.finalScore, 0) / rankedResults.length).toFixed(1))
      : 0
    const bottomTwoNames = isPublicVisible
      ? rankedResults
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .slice(-2)
        .map((item) => item.name)
        .join('、') || '-'
      : '-'

    cycleSummary.value = {
      employeeCount,
      submittedCount,
      validVotingCount,
      pendingCount,
      averageScore,
      bottomTwoNames,
      isPublicVisible: isPublicVisible,
      currentLabel: cycleLabel(cycleOverview.value.displayCycle),
      currentPeriodText: cyclePeriodText(cycleOverview.value.displayCycle),
      publicLabel: cycleLabel(cycleOverview.value.publicCycle),
      workLabel: cycleLabel(cycleOverview.value.workCycle),
      stageLabel: stageLabel(cycleOverview.value),
      deadlineExact: stageDeadline(cycleOverview.value),
      deadlineAt: stageDeadlineAt(cycleOverview.value)
    }
  }

  function applyPublicResults(payload: any) {
    const publicViewCycle = normalizeCycle(payload?.cycle)
    publicCycle.value = payload?.isPublished ? publicViewCycle : cycleOverview.value.publicCycle
    publicEmployees.value = mapPeople(payload?.employees || [])

    const columnCount = publicEmployees.value.length
    const mappedRows = (payload?.matrix || []).map((row: any, index: number) => ({
      rowLabel: `匿名-${String(index + 1).padStart(2, '0')}`,
      employeeId: String(row.anonymousRowKey || `anonymous-${index + 1}`),
      values: (row.values || []).map((value: any) => value === false ? false : (value == null ? null : Number(value))),
      valid: Boolean(row.valid)
    })) as PublicMatrixRow[]
    publicMatrixRows.value = mappedRows.length
      ? mappedRows
      : placeholderMatrixRows(columnCount, columnCount)

    results.value = (payload?.ranking || []).map((item: any) => ({
      employeeId: String(item.userId),
      name: String(item.fullName || ''),
      department: '电控组',
      peerAverage: Number(item.peerAverageScore || 0),
      finalScore: Number(item.finalScore || 0),
      rank: Number(item.rankPosition || 0),
      usedVotingRight: Boolean(item.usedVotingRight),
      isBottomTwo: Boolean(item.isBottomTwo)
    }))

    if (!results.value.length && publicEmployees.value.length) {
      results.value = publicEmployees.value.map((employee, index) => ({
        employeeId: employee.id,
        name: employee.name,
        department: employee.department,
        peerAverage: 0,
        finalScore: 0,
        rank: index + 1,
        usedVotingRight: false,
        isBottomTwo: index >= Math.max(publicEmployees.value.length - 2, 0)
      }))
    }

    rebuildSummary()
  }

  function populateLeaderList() {
    leaderList.value = users.value
      .filter((item) => item.role === 'leader' && item.is_active === 1)
      .map((item) => ({
        id: String(item.id),
        name: item.full_name,
        label: item.full_name
      }))
  }

  async function loadCycleOverview() {
    const payload = await api.getCycleOverview()
    syncOverview(payload)
    rebuildSummary()
  }

  async function loadEmployeeCycle() {
    const payload = await api.getEmployeeCurrentCycle()
    cycle.value = normalizeCycle(payload?.cycle)
    if (cycleOverview.value.workCycle?.id !== cycle.value?.id) {
      await loadCycleOverview()
    }

    employeeList.value = mapPeople(payload?.employees || [])

    if (currentEmployee.value) {
      const scoreMap: ScoreMap = {}
      for (const employee of employeeList.value) {
        scoreMap[employee.id] = null
      }
      for (const item of payload?.scores || []) {
        scoreMap[String(item.targetUserId)] = Number(item.score)
      }
      employeeScores.value[currentEmployee.value.id] = scoreMap

      submissions.value[currentEmployee.value.id] = {
        usedVotingRight: Boolean(payload?.progress?.usedVotingRight),
        submittedAt: payload?.progress?.submittedAt || null
      }
    }

    rebuildSummary()
  }

  async function loadLeaderCycle() {
    const payload = await api.getLeaderCurrentCycle()
    cycle.value = normalizeCycle(payload?.cycle)
    employeeList.value = mapPeople(payload?.members || [])

    if (currentLeader.value) {
      leaderScores.value[currentLeader.value.id] = {}
      for (const row of payload?.scores || []) {
        leaderScores.value[currentLeader.value.id][String(row.targetUserId)] = Number(row.score)
      }
    }

    rebuildSummary()
  }

  async function loadCurrentPublicResults() {
    const payload = await api.getCurrentPublicCycle()
    applyPublicResults(payload)
  }

  async function loadPublicResults() {
    try {
      await loadCurrentPublicResults()
    } catch {
      results.value = []
      publicMatrixRows.value = placeholderMatrixRows(employeeList.value.length, employeeList.value.length)
      rebuildSummary()
    }
  }

  async function loadDashboard() {
    const payload = await api.getAdminDashboard()
    dashboard.value = payload
    syncOverview(payload?.overview || emptyOverview())
    cycle.value = normalizeCycle(payload?.cycle)
    publicCycle.value = normalizeCycle(payload?.publicCycle)
    members.value = (payload?.members || []) as MemberRecord[]
    users.value = (payload?.users || []) as MemberRecord[]
    populateLeaderList()

    submissions.value = {}
    for (const item of payload?.submissions || []) {
      submissions.value[String(item.user_id)] = {
        usedVotingRight: item.used_voting_right === 1,
        submittedAt: item.submitted_at || null
      }
    }

    employeeList.value = mapPeople((payload?.members || []).filter((item: any) => item.is_participant === 1 || item.is_participant == null))

    rebuildSummary()
  }

  async function login(username: string, password: string) {
    try {
      const payload = await api.login({ username, password })
      token.value = payload.token
      setToken(payload.token)
      const role = mapRole(payload.user.role)
      const linkedEmployeeId = role === 'member' ? String(payload.user.id) : undefined
      const linkedLeaderId = role === 'leader' ? String(payload.user.id) : undefined

      currentAccount.value = {
        id: String(payload.user.id),
        username: payload.user.username,
        displayName: payload.user.fullName,
        role,
        roleLabel: mapRoleLabel(role),
        linkedEmployeeId,
        linkedLeaderId,
        firstLogin: Boolean(payload.user.forcePasswordChange)
      }

      await loadCycleOverview()
      if (role === 'member') {
        await loadEmployeeCycle().catch(() => undefined)
      }
      if (role === 'leader') {
        await loadLeaderCycle().catch(() => undefined)
      }
      if (role === 'admin') {
        await loadDashboard().catch(() => undefined)
      }
      await loadPublicResults().catch(() => undefined)

      return { ok: true as const, account: currentAccount.value }
    } catch (error: any) {
      return { ok: false as const, reason: error.message || '登录失败' }
    }
  }

  function logout() {
    clearToken()
    token.value = ''
    currentAccount.value = null
    cycleOverview.value = emptyOverview()
  }

  async function updatePassword(currentPassword: string, nextPassword: string) {
    await api.changePassword({ currentPassword, newPassword: nextPassword })
    if (currentAccount.value) {
      currentAccount.value.firstLogin = false
    }
  }

  function updateEmployeeScores(nextScores: ScoreMap) {
    if (!currentEmployee.value) return
    employeeScores.value[currentEmployee.value.id] = { ...nextScores }
  }

  async function submitEmployeeScores() {
    if (!currentEmployee.value) return false
    const draft = employeeScores.value[currentEmployee.value.id] || {}
    const scores = Object.entries(draft).map(([targetUserId, score]) => ({
      targetUserId: Number(targetUserId),
      score
    }))
    const result = await api.submitEmployeeScores(scores)
    submissions.value[currentEmployee.value.id] = {
      usedVotingRight: Boolean(result.usedVotingRight),
      submittedAt: new Date().toISOString().slice(0, 23).replace('T', ' ')
    }
    rebuildSummary()
    return Boolean(result.usedVotingRight)
  }

  function updateLeaderScore(employeeId: string, score: number) {
    if (!currentLeader.value) return
    if (!leaderScores.value[currentLeader.value.id]) {
      leaderScores.value[currentLeader.value.id] = {}
    }
    leaderScores.value[currentLeader.value.id][employeeId] = score
  }

  async function submitLeaderScores() {
    if (!currentLeader.value) return
    const scoreMap = leaderScores.value[currentLeader.value.id] || {}
    const scores = Object.entries(scoreMap).map(([targetUserId, score]) => ({
      targetUserId: Number(targetUserId),
      score
    }))
    await api.submitManagerScores(scores)
  }

  async function settleCycle(cycleId?: number) {
    const payload = await api.settle(cycleId)
    await loadCycleOverview()
    applyPublicResults({ ...payload, isPublished: true })
    if (currentAccount.value?.role === 'admin') {
      await loadDashboard().catch(() => undefined)
    }
    return payload
  }

  async function triggerAutomaticSettlement() {
    const payload = await api.settleAutomatic()
    await loadCycleOverview()
    await loadPublicResults().catch(() => undefined)
    return payload
  }

  async function createMember(payload: { username: string; fullName: string; password: string }) {
    await api.createMember(payload)
    await loadDashboard()
  }

  async function changeUserRole(id: number, role: Role) {
    await api.updateUserRole(id, role)
    await loadDashboard()
  }

  async function changeUserParticipation(id: number, isParticipant: boolean) {
    await api.updateUserParticipation(id, isParticipant)
    await loadDashboard()
  }

  async function changeUserActive(id: number, isActive: boolean) {
    await api.updateUserActive(id, isActive)
    await loadDashboard()
  }

  async function deactivateSelf() {
    await api.deactivateSelf()
    logout()
  }

  async function loadSchedulingConfig() {
    schedulingConfig.value = await api.getSchedulingConfig()
  }

  async function saveSchedulingConfig(patch: Record<string, number>) {
    schedulingConfig.value = await api.updateSchedulingConfig(patch)
  }

  async function loadAllCycles() {
    const payload = await api.getAdminCycles()
    allCycles.value = payload.cycles
  }

  async function createNewCycle(payload: { name?: string; start_at?: string; end_at?: string }) {
    await api.createCycle(payload)
    await loadAllCycles()
    await loadCycleOverview()
    await loadDashboard()
  }

  async function updateExistingCycle(id: number, payload: { name?: string; start_at?: string; end_at?: string }) {
    await api.updateCycle(id, payload)
    await loadAllCycles()
    await loadCycleOverview()
    await loadDashboard()
  }

  async function removeCycle(id: number) {
    await api.deleteCycle(id)
    await loadAllCycles()
    await loadCycleOverview()
    await loadDashboard()
  }

  function quickLogin() {
    return { ok: false as const, reason: '已切换为真实后端登录，不再支持演示快捷登录' }
  }

  return {
    token,
    accountList,
    currentAccount,
    currentEmployee,
    currentLeader,
    employeeList,
    publicEmployees,
    employeeScores,
    leaderList,
    leaderScores,
    submissions,
    results,
    cycleSummary,
    cycle,
    publicCycle,
    dashboard,
    members,
    users,
    cycleOverview,
    historyCycles,
    schedulingConfig,
    allCycles,
    employeeDraftComplete,
    employeeAlreadySubmitted,
    publicMatrixRows,
    login,
    logout,
    updatePassword,
    updateEmployeeScores,
    submitEmployeeScores,
    updateLeaderScore,
    submitLeaderScores,
    settleCycle,
    triggerAutomaticSettlement,
    createMember,
    changeUserRole,
    changeUserParticipation,
    changeUserActive,
    deactivateSelf,
    loadSchedulingConfig,
    saveSchedulingConfig,
    loadAllCycles,
    createNewCycle,
    updateExistingCycle,
    removeCycle,
    loadEmployeeCycle,
    loadLeaderCycle,
    loadPublicResults,
    loadCycleOverview,
    loadDashboard,
    quickLogin
  }
})
