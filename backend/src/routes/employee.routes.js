import express from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { listMembers, getMyProgress, isCycleParticipant } from '../services/cycle.service.js'
import { getCurrentPublicCyclePure, getCurrentWorkCyclePure } from '../services/cycle-lifecycle.service.js'
import { getEmployeeScores, saveEmployeeScores } from '../services/score.service.js'
import { getPublicResults } from '../services/settlement.service.js'

export const employeeRouter = express.Router()

employeeRouter.use(requireAuth, requireRole('member'))

employeeRouter.get('/current-cycle', (req, res) => {
  const cycle = getCurrentWorkCyclePure()
  if (!cycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })
  if (!isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '浣犳湭琚撼鍏ユ湰鏈熻瘎鍒嗗懆鏈?' })
  }

  res.json({
    cycle,
    employees: listMembers(cycle.id),
    progress: getMyProgress(req.user.id, cycle.id),
    scores: getEmployeeScores(cycle.id, req.user.id)
  })
})

employeeRouter.post('/scores', (req, res) => {
  const cycle = getCurrentWorkCyclePure()
  if (!cycle) return res.status(404).json({ message: '鏆傛棤璇勫垎鍛ㄦ湡' })
  if (!isCycleParticipant(cycle.id, req.user.id)) {
    return res.status(403).json({ message: '浣犳湭琚撼鍏ユ湰鏈熻瘎鍒嗗懆鏈?' })
  }
  if (!['draft', 'active'].includes(cycle.status)) {
    return res.status(400).json({ message: '褰撳墠璇勫垎鍛ㄦ湡涓嶅彲鎻愪氦' })
  }

  try {
    const result = saveEmployeeScores(cycle.id, req.user.id, req.body.scores || [])
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

employeeRouter.get('/public-results', (_req, res) => {
  const cycle = getCurrentPublicCyclePure()
  if (!cycle || cycle.status !== 'settled') {
    return res.status(400).json({ message: '褰撳墠鏆傛棤宸插叕绀虹粨鏋?' })
  }
  res.json({ cycle, ...getPublicResults(cycle.id) })
})
