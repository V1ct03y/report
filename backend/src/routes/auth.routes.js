import express from 'express'
import { login, changePassword } from '../services/auth.service.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = express.Router()

authRouter.post('/login', (req, res) => {
  try {
    const result = login({
      username: req.body.username,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || ''
    })
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

authRouter.post('/change-password', requireAuth, (req, res) => {
  try {
    const result = changePassword(req.user.id, req.body.currentPassword, req.body.newPassword)
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})
