import { db } from '../db/client.js'
import { listCycleParticipants, isCycleParticipant } from './cycle.service.js'

export function getEmployeeScores(cycleId, userId) {
  return db.prepare('SELECT target_user_id as targetUserId, score FROM employee_scores WHERE cycle_id = ? AND rater_user_id = ? ORDER BY target_user_id ASC').all(cycleId, userId)
}

export function saveEmployeeScores(cycleId, raterUserId, scores) {
  if (!isCycleParticipant(cycleId, raterUserId)) {
    throw new Error('当前账号未参与本期评分')
  }

  const memberIds = listCycleParticipants(cycleId, ['member']).map((row) => row.id)
  const scoreMap = new Map(scores.map((item) => [Number(item.targetUserId), Number(item.score)]))

  const insert = db.prepare('INSERT INTO employee_scores (cycle_id, rater_user_id, target_user_id, score) VALUES (?, ?, ?, ?) ON CONFLICT(cycle_id, rater_user_id, target_user_id) DO UPDATE SET score = excluded.score, updated_at = CURRENT_TIMESTAMP')
  const removeMissing = db.prepare('DELETE FROM employee_scores WHERE cycle_id = ? AND rater_user_id = ?')
  const upsertSubmission = db.prepare('INSERT INTO employee_score_submissions (cycle_id, user_id, completed_count, required_count, used_voting_right, submitted_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(cycle_id, user_id) DO UPDATE SET completed_count = excluded.completed_count, required_count = excluded.required_count, used_voting_right = excluded.used_voting_right, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP')

  const tx = db.transaction(() => {
    removeMissing.run(cycleId, raterUserId)

    for (const targetUserId of memberIds) {
      const score = scoreMap.get(targetUserId)
      if (Number.isFinite(score)) {
        insert.run(cycleId, raterUserId, targetUserId, score)
      }
    }

    const completedCount = db.prepare('SELECT COUNT(*) as count FROM employee_scores WHERE cycle_id = ? AND rater_user_id = ?').get(cycleId, raterUserId).count
    const requiredCount = memberIds.length
    const usedVotingRight = completedCount === requiredCount ? 1 : 0
    upsertSubmission.run(cycleId, raterUserId, completedCount, requiredCount, usedVotingRight)

    return { completedCount, requiredCount, usedVotingRight: !!usedVotingRight }
  })

  return tx()
}

export function saveManagerScores(cycleId, managerUserId, scores) {
  if (!isCycleParticipant(cycleId, managerUserId)) {
    throw new Error('当前账号未参与本期评分')
  }

  const memberIds = new Set(listCycleParticipants(cycleId, ['member']).map((row) => row.id))
  const insert = db.prepare('INSERT INTO manager_scores (cycle_id, manager_user_id, target_user_id, score) VALUES (?, ?, ?, ?) ON CONFLICT(cycle_id, manager_user_id, target_user_id) DO UPDATE SET score = excluded.score, updated_at = CURRENT_TIMESTAMP')

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM manager_scores WHERE cycle_id = ? AND manager_user_id = ?').run(cycleId, managerUserId)
    for (const item of scores) {
      const targetUserId = Number(item.targetUserId)
      if (!memberIds.has(targetUserId)) continue
      insert.run(cycleId, managerUserId, targetUserId, Number(item.score))
    }
  })
  tx()
  return { success: true }
}
