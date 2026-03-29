import { db } from '../db/client.js'
import { hashPassword } from '../utils/crypto.js'
import { getCurrentWorkCyclePure, getPendingPublicationCyclePure } from './cycle-lifecycle.service.js'

const VALID_ROLES = new Set(['admin', 'leader', 'member'])

function normalizeRole(role) {
  if (role === 'manager') return 'leader'
  if (role === 'employee') return 'member'
  return role
}

export function listUsersForDashboard(cycleId = null) {
  const activeCycleId = cycleId || getCurrentWorkCyclePure()?.id || getPendingPublicationCyclePure()?.id || null

  return db.prepare(`
    SELECT u.id,
           u.username,
           u.full_name,
           u.role,
           u.is_active,
           u.created_at,
           COALESCE(cp.is_participant, 1) AS is_participant,
           CASE
             WHEN u.role = 'leader' THEN COALESCE(ms.saved_count, 0)
             ELSE s.completed_count
           END AS completed_count,
           CASE
             WHEN u.role = 'leader' THEN COALESCE(req.required_count, 0)
             ELSE s.required_count
           END AS required_count,
           CASE
             WHEN u.role = 'leader' THEN CASE
               WHEN COALESCE(ms.saved_count, 0) > 0 THEN 1
               ELSE 0
             END
             ELSE s.used_voting_right
           END AS used_voting_right,
           CASE
             WHEN u.role = 'leader' THEN ms.submitted_at
             ELSE s.submitted_at
           END AS submitted_at
    FROM users u
    LEFT JOIN cycle_participants cp
      ON cp.user_id = u.id AND cp.cycle_id = ?
    LEFT JOIN employee_score_submissions s
      ON s.user_id = u.id AND s.cycle_id = ?
    LEFT JOIN (
      SELECT cycle_id,
             manager_user_id,
             COUNT(*) AS saved_count,
             MAX(updated_at) AS submitted_at
      FROM manager_scores
      GROUP BY cycle_id, manager_user_id
    ) ms
      ON ms.manager_user_id = u.id AND ms.cycle_id = ?
    LEFT JOIN (
      SELECT ? AS cycle_id,
             COUNT(*) AS required_count
      FROM users u2
      LEFT JOIN cycle_participants cp2
        ON cp2.user_id = u2.id AND cp2.cycle_id = ?
      WHERE u2.role = 'member'
        AND u2.is_active = 1
        AND COALESCE(cp2.is_participant, 1) = 1
    ) req
      ON req.cycle_id = ?
    ORDER BY u.id ASC
  `).all(activeCycleId, activeCycleId, activeCycleId, activeCycleId, activeCycleId, activeCycleId)
}

export function createMember({ username, fullName, password }) {
  const stmt = db.prepare('INSERT INTO users (username, full_name, password_hash, role, force_password_change, is_active) VALUES (?, ?, ?, \'member\', 1, 1)')
  const result = stmt.run(username, fullName, hashPassword(password || 'ChangeMe123!'))
  return db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid)
}

export function updateUserRole(userId, nextRole, actingUserId) {
  const role = normalizeRole(nextRole)
  if (!VALID_ROLES.has(role)) {
    throw new Error('角色不合法')
  }

  const user = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('用户不存在')

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, userId)

    if (Number(user.id) === Number(actingUserId) && role !== 'admin') {
      const hasAnotherAdmin = db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = \'admin\' AND is_active = 1 AND id != ?').get(actingUserId).count > 0
      if (!hasAnotherAdmin) {
        throw new Error('请先将其他现有账号提升为 admin，再变更自己的角色')
      }
    }
  })

  tx()

  return db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(userId)
}

export function setUserActive(userId, isActive, actingUserId) {
  const user = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('用户不存在')

  if (!Number.isInteger(isActive) || ![0, 1].includes(isActive)) {
    throw new Error('账号状态不合法')
  }

  if (user.role === 'admin' && isActive === 0) {
    const anotherAdminCount = db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = \'admin\' AND is_active = 1 AND id != ?').get(userId).count
    if (anotherAdminCount < 1) {
      throw new Error('当前仅剩一个 admin，请先提升其他账号为 admin，再停用该账号')
    }
  }

  db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isActive, userId)

  return db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(userId)
}

export function deactivateSelfIfAllowed(actingUserId) {
  return setUserActive(Number(actingUserId), 0, actingUserId)
}

export function setCycleParticipation(cycleId, userId, isParticipant) {
  const participantFlag = isParticipant ? 1 : 0
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId)

  if (!user) throw new Error('用户不存在')
  if (!['member', 'leader'].includes(user.role)) {
    throw new Error('只有 member 或 leader 可以设置周期参与状态')
  }

  db.prepare(`
    INSERT INTO cycle_participants (cycle_id, user_id, is_participant, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id, user_id)
    DO UPDATE SET is_participant = excluded.is_participant, updated_at = CURRENT_TIMESTAMP
  `).run(cycleId, userId, participantFlag)

  return { success: true, cycleId, userId, isParticipant: Boolean(participantFlag) }
}
