import { db } from '../db/client.js'

function participationFilter(cycleId) {
  return {
    join: 'LEFT JOIN cycle_participants cp ON cp.user_id = u.id AND cp.cycle_id = ?',
    where: 'COALESCE(cp.is_participant, 1) = 1',
    params: [cycleId]
  }
}

export function listCycleParticipants(cycleId, roles = ['member']) {
  const placeholders = roles.map(() => '?').join(', ')
  const filter = participationFilter(cycleId)

  return db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role
    FROM users u
    ${filter.join}
    WHERE u.role IN (${placeholders})
      AND u.is_active = 1
      AND ${filter.where}
    ORDER BY u.id ASC
  `).all(cycleId, ...roles)
}

export function listMembers(cycleId) {
  return listCycleParticipants(cycleId, ['member'])
}

export function listMembersWithStatus(cycleId) {
  return db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.is_active,
           COALESCE(cp.is_participant, 1) AS is_participant,
           s.completed_count, s.required_count, s.used_voting_right, s.submitted_at
    FROM users u
    LEFT JOIN cycle_participants cp
      ON cp.user_id = u.id AND cp.cycle_id = ?
    LEFT JOIN employee_score_submissions s
      ON s.user_id = u.id AND s.cycle_id = ?
    WHERE u.role = 'member'
    ORDER BY u.id ASC
  `).all(cycleId, cycleId)
}

export function getMyProgress(userId, cycleId) {
  const memberCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM users u
    LEFT JOIN cycle_participants cp
      ON cp.user_id = u.id AND cp.cycle_id = ?
    WHERE u.role = 'member'
      AND u.is_active = 1
      AND COALESCE(cp.is_participant, 1) = 1
  `).get(cycleId).count

  const submission = db.prepare('SELECT completed_count, required_count, used_voting_right, submitted_at FROM employee_score_submissions WHERE cycle_id = ? AND user_id = ?').get(cycleId, userId)

  return {
    requiredCount: memberCount,
    completedCount: submission?.completed_count || 0,
    submittedAt: submission?.submitted_at || null,
    usedVotingRight: submission?.used_voting_right ?? null,
    isComplete: (submission?.completed_count || 0) === memberCount
  }
}

export function isCycleParticipant(cycleId, userId) {
  const row = db.prepare(`
    SELECT u.id
    FROM users u
    LEFT JOIN cycle_participants cp ON cp.user_id = u.id AND cp.cycle_id = ?
    WHERE u.id = ?
      AND u.is_active = 1
      AND u.role IN ('member', 'leader')
      AND COALESCE(cp.is_participant, 1) = 1
  `).get(cycleId, userId)

  return Boolean(row)
}
