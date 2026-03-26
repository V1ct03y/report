import express from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { listMembers, getMyProgress, isCycleParticipant } from '../services/cycle.service.js'
import { getCurrentPublicCycle, getCurrentWorkCycle } from '../services/cycle-lifecycle.service.js'
import { getEmployeeScores, saveEmployeeScores } from '../services/score.service.js'
import { getPublicResults, settlePendingCycles } from '../services/settlement.service.js'

export const employeeRouter = express.Router()

employeeRouter.use(requireAuth, requireRole('member'))
employeeRouter.use((_req, _res, next) => {
  settlePendingCycles()
  next()
})

employeeRouter.get('/current-cycle', (req, res) => {
  const cycle = getCurrentWorkCycle()
  if (!cycle) return res.status(404).json({ message: '暂无评分周期' })
  if (!isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '你未被纳入本期评分周期' })
  }

  res.json({
    cycle,
    employees: listMembers(cycle.id),
    progress: getMyProgress(req.user.id, cycle.id),
    scores: getEmployeeScores(cycle.id, req.user.id)
  })
})

employeeRouter.post('/scores', (req, res) => {
  const cycle = getCurrentWorkCycle()
  if (!cycle) return res.status(404).json({ message: '暂无评分周期' })
  if (!isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '你未被纳入本期评分周期' })
  }
  if (!['draft', 'active'].includes(cycle.status)) {
    return res.status(400).json({ message: '当前评分周期不可提交' })
  }

  try {
    const result = saveEmployeeScores(cycle.id, req.user.id, req.body.scores || [])
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

employeeRouter.get('/public-results', (_req, res) => {
  const cycle = getCurrentPublicCycle()
  if (!cycle || cycle.status !== 'settled') {
    return res.status(400).json({ message: '当前暂无已公示结果' })
  }
  res.json({ cycle, ...getPublicResults(cycle.id) })
})
