import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  getCurrentPublicCyclePure,
  getCurrentWorkCyclePure,
  getCycleById,
  getCycleOverviewPure,
  listCycleHistoryPure
} from '../services/cycle-lifecycle.service.js'
import { getPublicResults } from '../services/settlement.service.js'

export const cycleRouter = express.Router()

cycleRouter.use(requireAuth)

cycleRouter.get('/overview', (_req, res) => {
  res.json(getCycleOverviewPure())
})

cycleRouter.get('/current', (_req, res) => {
  res.json({ cycle: getCycleOverviewPure().displayCycle })
})

cycleRouter.get('/current/work', (_req, res) => {
  res.json({ cycle: getCurrentWorkCyclePure() })
})

cycleRouter.get('/current/public', (_req, res) => {
  const cycle = getCurrentPublicCyclePure()
  if (!cycle) {
    return res.json({
      cycle: null,
      employees: [],
      matrix: [],
      ranking: [],
      isPublished: false
    })
  }

  res.json({
    cycle,
    ...getPublicResults(cycle.id),
    isPublished: true
  })
})

cycleRouter.get('/history', (_req, res) => {
  res.json({ cycles: listCycleHistoryPure() })
})

cycleRouter.get('/:id/results', (req, res) => {
  const cycle = getCycleById(Number(req.params.id))
  if (!cycle) return res.status(404).json({ message: '鍛ㄦ湡涓嶅瓨鍦?' })
  res.json({
    cycle,
    ...getPublicResults(cycle.id),
    isPublished: Boolean(cycle.published_at)
  })
})
