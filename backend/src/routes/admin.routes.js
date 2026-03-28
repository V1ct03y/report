import express from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { db } from '../db/client.js'
import { listMembers, listMembersWithStatus, isCycleParticipant } from '../services/cycle.service.js'
import {
  getCycleById,
  getCycleOverviewPure,
  getCurrentPublicCyclePure,
  getCurrentWorkCyclePure
} from '../services/cycle-lifecycle.service.js'
import { saveManagerScores } from '../services/score.service.js'
import { settleCycle, getPreviewResults, getPublicResults, settlePendingCycles } from '../services/settlement.service.js'
import {
  listAllCycles,
  createCycle,
  updateCycle,
  deleteCycle
} from '../services/cycle-admin.service.js'
import {
  archiveCycle,
  getAdminCycleControl,
  getAdminResultsCycle,
  publishCycle,
  reconcileCycleTimeline
} from '../services/cycle-control.service.js'
import {
  getSchedulingConfig,
  updateSchedulingConfig,
  getNextScheduledEvents,
  formatScheduleDesc
} from '../services/scheduling.service.js'
import {
  createMember,
  deactivateSelfIfAllowed,
  listUsersForDashboard,
  setCycleParticipation,
  setUserActive,
  updateUserRole
} from '../services/user-admin.service.js'

export const adminRouter = express.Router()

adminRouter.use(requireAuth)

adminRouter.get('/dashboard', requireRole('admin'), (_req, res) => {
  const workCycle = getCurrentWorkCyclePure()
  const publicCycle = getCurrentPublicCyclePure()
  const participants = workCycle
    ? db.prepare(`
      SELECT u.id, u.full_name
      FROM users u
      LEFT JOIN cycle_participants cp ON cp.user_id = u.id AND cp.cycle_id = ?
      WHERE u.role = 'member'
        AND u.is_active = 1
        AND COALESCE(cp.is_participant, 1) = 1
      ORDER BY u.id ASC
    `).all(workCycle.id)
    : []
  const submissions = workCycle
    ? db.prepare(`
      SELECT s.user_id, s.completed_count, s.required_count, s.used_voting_right, s.submitted_at
      FROM employee_score_submissions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN cycle_participants cp ON cp.user_id = u.id AND cp.cycle_id = s.cycle_id
      WHERE s.cycle_id = ?
        AND u.role = 'member'
        AND COALESCE(cp.is_participant, 1) = 1
    `).all(workCycle.id)
    : []

  res.json({
    cycle: workCycle,
    publicCycle,
    overview: getCycleOverviewPure(),
    cycleControl: getAdminCycleControl(),
    employeeCount: participants.length,
    submittedCount: submissions.filter((item) => item.submitted_at).length,
    completedCount: submissions.filter((item) => item.completed_count === item.required_count).length,
    invalidCount: submissions.filter((item) => item.used_voting_right === 0).length,
    submissions,
    members: workCycle ? listMembersWithStatus(workCycle.id) : [],
    users: listUsersForDashboard(workCycle?.id || null)
  })
})

adminRouter.get('/cycle-control', requireRole('admin'), (_req, res) => {
  res.json(getAdminCycleControl())
})

adminRouter.post('/cycle-control/reconcile', requireRole('admin'), (_req, res) => {
  reconcileCycleTimeline()
  res.json(getAdminCycleControl())
})

adminRouter.get('/leader/current-cycle', requireRole('leader'), (req, res) => {
  const cycle = getCurrentWorkCyclePure()
  if (!cycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })
  if (!isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '褰撳墠璐﹀彿鏈弬涓庢湰鏈熻瘎鍒?' })
  }

  const members = listMembers(cycle.id)
  const scores = db.prepare(`
    SELECT target_user_id AS targetUserId, score
    FROM manager_scores
    WHERE cycle_id = ? AND manager_user_id = ?
    ORDER BY target_user_id ASC
  `).all(cycle.id, req.user.id)

  res.json({ cycle, members, scores, ...getPreviewResults(cycle.id), isPublished: Boolean(cycle.published_at) })
})

adminRouter.post('/manager-scores', requireRole('leader'), (req, res) => {
  const cycle = getCurrentWorkCyclePure()
  if (!cycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })
  if (!isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '褰撳墠璐﹀彿鏈弬涓庢湰鏈熻瘎鍒?' })
  }

  try {
    const result = saveManagerScores(cycle.id, req.user.id, req.body.scores || [])
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.post('/settle', requireRole('admin'), (req, res) => {
  const cycleId = req.body?.cycleId ? Number(req.body.cycleId) : null
  const targetCycle = cycleId ? getCycleById(cycleId) : getCurrentWorkCyclePure()
  if (!targetCycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })

  try {
    const results = settleCycle(targetCycle.id, 'manual')
    res.json({
      cycle: getCycleById(targetCycle.id),
      ...results,
      isPublished: false
    })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.post('/settle/automatic', requireRole('admin'), (_req, res) => {
  res.json({ settled: settlePendingCycles() })
})

adminRouter.post('/cycles/:id/publish', requireRole('admin'), (req, res) => {
  try {
    const cycle = publishCycle(Number(req.params.id))
    res.json({
      cycle,
      ...getPublicResults(cycle.id),
      isPublished: true
    })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.post('/cycles/:id/archive', requireRole('admin'), (req, res) => {
  try {
    const cycle = archiveCycle(Number(req.params.id))
    res.json({ cycle })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.get('/results', requireRole('admin', 'leader'), (req, res) => {
  const cycle = req.user.role === 'leader'
    ? getCurrentWorkCyclePure()
    : (getAdminResultsCycle() || getCurrentWorkCyclePure())
  if (!cycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })

  if (req.user.role === 'leader' && !isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '褰撳墠璐﹀彿鏈弬涓庢湰鏈熻瘎鍒?' })
  }

  const resultPayload = cycle.status === 'settled' || cycle.published_at
    ? getPublicResults(cycle.id)
    : getPreviewResults(cycle.id)

  res.json({
    cycle,
    ...resultPayload,
    isPublished: Boolean(cycle.published_at)
  })
})

adminRouter.post('/members', requireRole('admin'), (req, res) => {
  try {
    const member = createMember({
      username: req.body.username,
      fullName: req.body.fullName,
      password: req.body.password
    })
    res.json({ member })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.patch('/users/:id/role', requireRole('admin'), (req, res) => {
  try {
    const user = updateUserRole(Number(req.params.id), req.body?.role, req.user.id)
    res.json({ user })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.patch('/users/:id/active', requireRole('admin'), (req, res) => {
  try {
    const isActive = Number(req.body?.isActive ? 1 : 0)
    const user = setUserActive(Number(req.params.id), isActive, req.user.id)
    res.json({ user })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.patch('/users/:id/participation', requireRole('admin'), (req, res) => {
  const cycle = getCurrentWorkCyclePure()
  if (!cycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })

  try {
    const result = setCycleParticipation(cycle.id, Number(req.params.id), Boolean(req.body?.isParticipant))
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.post('/self/deactivate', requireRole('admin'), (req, res) => {
  try {
    const user = deactivateSelfIfAllowed(req.user.id)
    res.json({ user })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.get('/scheduling', requireRole('admin'), (_req, res) => {
  const config = getSchedulingConfig()
  const nextEvents = getNextScheduledEvents()
  res.json({
    ...config,
    description: formatScheduleDesc(config),
    nextOpenAt: nextEvents.openDate,
    nextCloseAt: nextEvents.closeDate
  })
})

adminRouter.patch('/scheduling', requireRole('admin'), (req, res) => {
  try {
    const config = updateSchedulingConfig(req.body)
    const nextEvents = getNextScheduledEvents()
    res.json({
      ...config,
      description: formatScheduleDesc(config),
      nextOpenAt: nextEvents.openDate,
      nextCloseAt: nextEvents.closeDate
    })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.get('/cycles', requireRole('admin'), (_req, res) => {
  res.json({ cycles: listAllCycles() })
})

adminRouter.post('/cycles', requireRole('admin'), (req, res) => {
  try {
    const cycle = createCycle(req.body)
    res.status(201).json({ cycle })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.patch('/cycles/:id', requireRole('admin'), (req, res) => {
  try {
    const cycle = updateCycle(Number(req.params.id), req.body)
    res.json({ cycle })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

adminRouter.delete('/cycles/:id', requireRole('admin'), (req, res) => {
  try {
    const result = deleteCycle(Number(req.params.id))
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})
