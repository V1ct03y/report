import { db } from '../db/client.js'
import {
  archiveOlderPublicCycles,
  currentSqlTimestamp,
  findAutomaticSettlementCandidates,
  getCycleById
} from './cycle-lifecycle.service.js'
import { listCycleParticipants } from './cycle.service.js'

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getCycleParticipants(cycleId) {
  const participants = listCycleParticipants(cycleId, ['member'])
  if (participants.length) {
    return participants.map((item) => ({ id: item.id, full_name: item.full_name }))
  }

  return db.prepare(`
    SELECT id, full_name
    FROM users
    WHERE role = 'member' AND is_active = 1
    ORDER BY id ASC
  `).all()
}

export function settleCycle(cycleId, settleMode = 'manual', settledAt = currentSqlTimestamp()) {
  const cycle = getCycleById(cycleId)
  if (!cycle) {
    throw new Error('周期不存在')
  }

  if (cycle.status === 'settled') {
    return getPublicResults(cycleId)
  }

  if (settleMode === 'automatic' && cycle.end_at && cycle.end_at > settledAt) {
    throw new Error('未到自动结算时间')
  }

  const employees = getCycleParticipants(cycleId)
  const validRaters = new Set(
    db.prepare('SELECT user_id FROM employee_score_submissions WHERE cycle_id = ? AND used_voting_right = 1').all(cycleId).map((row) => row.user_id)
  )
  const leaderIds = listCycleParticipants(cycleId, ['leader']).map((row) => row.id)

  const insertResult = db.prepare(`INSERT INTO settlement_results (
    cycle_id, user_id, self_score, self_score_valid, peer_average_score, manager_a_score, manager_b_score, final_score, rank_position, is_bottom_two, used_voting_right
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(cycle_id, user_id) DO UPDATE SET
    self_score = excluded.self_score,
    self_score_valid = excluded.self_score_valid,
    peer_average_score = excluded.peer_average_score,
    manager_a_score = excluded.manager_a_score,
    manager_b_score = excluded.manager_b_score,
    final_score = excluded.final_score,
    rank_position = excluded.rank_position,
    is_bottom_two = excluded.is_bottom_two,
    used_voting_right = excluded.used_voting_right,
    updated_at = CURRENT_TIMESTAMP`)

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM settlement_results WHERE cycle_id = ?').run(cycleId)

    const rows = employees.map((employee) => {
      const submission = db.prepare('SELECT used_voting_right FROM employee_score_submissions WHERE cycle_id = ? AND user_id = ?').get(cycleId, employee.id)
      const usedVotingRight = submission?.used_voting_right === 1
      const selfScoreRow = db.prepare('SELECT score FROM employee_scores WHERE cycle_id = ? AND rater_user_id = ? AND target_user_id = ?').get(cycleId, employee.id, employee.id)
      const selfScore = usedVotingRight ? (selfScoreRow?.score || 0) : 0

      const peerScores = db.prepare('SELECT score, rater_user_id FROM employee_scores WHERE cycle_id = ? AND target_user_id = ? AND rater_user_id != ?').all(cycleId, employee.id, employee.id)
        .filter((row) => validRaters.has(row.rater_user_id))
        .map((row) => row.score)
      const peerAverage = average(peerScores)

      const leaderScores = leaderIds.map((leaderId) => (
        db.prepare('SELECT score FROM manager_scores WHERE cycle_id = ? AND manager_user_id = ? AND target_user_id = ?').get(cycleId, leaderId, employee.id)?.score || 0
      ))
      const leaderAverage = average(leaderScores)
      const leaderWeight = leaderIds.length === 0 ? 0 : 0.5
      const finalScore = Number((leaderAverage * leaderWeight + selfScore * 0.1 + peerAverage * 0.4).toFixed(2))
      const leaderAScore = leaderScores[0] || 0
      const leaderBScore = leaderScores[1] || 0

      return {
        userId: employee.id,
        fullName: employee.full_name,
        selfScore,
        selfScoreValid: usedVotingRight ? 1 : 0,
        peerAverage,
        managerAScore: leaderAScore,
        managerBScore: leaderBScore,
        finalScore,
        usedVotingRight: usedVotingRight ? 1 : 0
      }
    }).sort((a, b) => b.finalScore - a.finalScore)

    rows.forEach((row, index) => {
      const rankPosition = index + 1
      const isBottomTwo = index >= Math.max(rows.length - 2, 0) ? 1 : 0
      insertResult.run(cycleId, row.userId, row.selfScore, row.selfScoreValid, row.peerAverage, row.managerAScore, row.managerBScore, row.finalScore, rankPosition, isBottomTwo, row.usedVotingRight)
    })

    db.prepare(`
      UPDATE rating_cycles
      SET status = 'settled',
          settled_at = ?,
          public_at = ?,
          settle_mode = ?,
          is_archived = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(settledAt, settledAt, settleMode, cycleId)

    archiveOlderPublicCycles(cycleId)
  })

  tx()
  return getPublicResults(cycleId)
}

export function getPublicMatrix(cycleId) {
  const employees = getCycleParticipants(cycleId)
  const targetIds = employees.map((item) => item.id)
  const submissions = db.prepare(`
    SELECT s.user_id, s.used_voting_right
    FROM employee_score_submissions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN cycle_participants cp ON cp.user_id = u.id AND cp.cycle_id = s.cycle_id
    WHERE s.cycle_id = ?
      AND u.role = 'member'
      AND u.is_active = 1
      AND COALESCE(cp.is_participant, 1) = 1
    ORDER BY RANDOM()
  `).all(cycleId)

  return submissions.map((submission) => {
    if (submission.used_voting_right !== 1) {
      return {
        anonymousRowKey: `invalid-${submission.user_id}`,
        values: targetIds.map(() => false),
        valid: false
      }
    }

    const scoreMap = new Map(db.prepare('SELECT target_user_id, score FROM employee_scores WHERE cycle_id = ? AND rater_user_id = ?').all(cycleId, submission.user_id).map((row) => [row.target_user_id, row.score]))
    return {
      anonymousRowKey: `valid-${submission.user_id}`,
      values: targetIds.map((id) => scoreMap.get(id) ?? null),
      valid: true
    }
  })
}

export function getPublicResults(cycleId) {
  const employees = getCycleParticipants(cycleId)
  const settledRows = db.prepare('SELECT * FROM settlement_results WHERE cycle_id = ?').all(cycleId)
    .sort((a, b) => {
      if (b.final_score !== a.final_score) return b.final_score - a.final_score
      return a.user_id - b.user_id
    })

  const results = settledRows.map((row, index) => ({
    ...row,
    rank_position: index + 1,
    is_bottom_two: index >= Math.max(settledRows.length - 2, 0) ? 1 : 0
  }))

  return {
    employees,
    matrix: getPublicMatrix(cycleId),
    ranking: results.map((row) => ({
      userId: row.user_id,
      fullName: employees.find((item) => item.id === row.user_id)?.full_name || '',
      selfScoreValid: !!row.self_score_valid,
      peerAverageScore: row.peer_average_score,
      finalScore: row.final_score,
      rankPosition: row.rank_position,
      isBottomTwo: !!row.is_bottom_two,
      usedVotingRight: !!row.used_voting_right
    }))
  }
}

export function settlePendingCycles(now = currentSqlTimestamp()) {
  const candidates = findAutomaticSettlementCandidates(now)
  if (!candidates.length) return []

  return candidates.map((cycle) => ({
    cycleId: cycle.id,
    results: settleCycle(cycle.id, 'automatic', now)
  }))
}
