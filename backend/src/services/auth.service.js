import { db } from '../db/client.js'
import { hashPassword, verifyPassword } from '../utils/crypto.js'
import { signToken } from '../utils/jwt.js'

export function login({ username, password, ipAddress = '', userAgent = '' }) {
  const user = db.prepare('SELECT id, username, full_name, password_hash, role, force_password_change, is_active FROM users WHERE username = ?').get(username)

  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    throw new Error('用户名或密码错误')
  }

  db.prepare('INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)').run(user.id, ipAddress, userAgent)

  const token = signToken({ id: user.id, username: user.username, fullName: user.full_name, role: user.role })

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role === 'employee' ? 'member' : (user.role === 'manager' ? 'leader' : user.role),
      forcePasswordChange: !!user.force_password_change
    }
  }
}

export function changePassword(userId, currentPassword, newPassword) {
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(userId)
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    throw new Error('原密码不正确')
  }

  db.prepare('UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hashPassword(newPassword), userId)

  return { success: true }
}
