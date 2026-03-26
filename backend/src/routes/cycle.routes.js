import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  getCurrentPublicCycle,
  getCurrentWorkCycle,
  getCycleById,
  getCycleOverview,
  listCycleHistory
} from '../services/cycle-lifecycle.service.js'
import { getPublicResults, settlePendingCycles } from '../services/settlement.service.js'

export const cycleRouter = express.Router()

cycleRouter.use(requireAuth)

cycleRouter.use((_req, _res, next) => {
  settlePendingCycles()
  next()
})

cycleRouter.get('/overview', (_req, res) => {
  res.json(getCycleOverview())
})

cycleRouter.get('/current', (_req, res) => {
  res.json({ cycle: getCycleOverview().displayCycle })
})

cycleRouter.get('/current/work', (_req, res) => {
  res.json({ cycle: getCurrentWorkCycle() })
})

cycleRouter.get('/current/public', (_req, res) => {
  const overview = getCycleOverview()
  const cycle = overview.displayCycle
  if (!cycle) return res.json({ cycle: null, employees: [], matrix: [], ranking: [], isPublished: false })

  res.json({
    cycle,
    ...getPublicResults(cycle.id),
    isPublished: Boolean(overview.publicCycle && overview.publicCycle.id === cycle.id)
  })
})

cycleRouter.get('/history', (_req, res) => {
  res.json({ cycles: listCycleHistory() })
})

cycleRouter.get('/:id/results', (req, res) => {
  const cycle = getCycleById(Number(req.params.id))
  if (!cycle) return res.status(404).json({ message: '周期不存在' })
  res.json({
    cycle,
    ...getPublicResults(cycle.id),
    isPublished: cycle.status === 'settled' && Boolean(cycle.public_at)
  })
})
