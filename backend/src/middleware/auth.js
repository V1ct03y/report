import { verifyToken } from '../utils/jwt.js'
import { db } from '../db/client.js'

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: '未登录' })
  }

  try {
    const payload = verifyToken(token)
    const user = db.prepare('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?').get(payload.id)
    if (!user || user.is_active !== 1) {
      return res.status(401).json({ message: '登录状态已失效' })
    }

    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    }

    next()
  } catch {
    return res.status(401).json({ message: '登录状态已失效' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: '无权限访问' })
    }
    next()
  }
}
