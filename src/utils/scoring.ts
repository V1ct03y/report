import type {
  CycleSummary,
  Employee,
  EmployeeResult,
  EmployeeScoreBook,
  EmployeeSubmission,
  Leader,
  LeaderScoreBook
} from '../types'

function round(value: number) {
  return Math.round(value * 100) / 100
}

export function computeResults(
  employees: Employee[],
  leaders: Leader[],
  employeeScores: EmployeeScoreBook,
  leaderScores: LeaderScoreBook,
  submissions: Record<string, EmployeeSubmission>
) {
  const results: EmployeeResult[] = employees.map((employee) => {
    const leaderA = leaderScores[leaders[0].id][employee.id] ?? 0
    const leaderB = leaderScores[leaders[1].id][employee.id] ?? 0
    const submission = submissions[employee.id]
    const selfScore =
      submission?.usedVotingRight === true ? (employeeScores[employee.id]?.[employee.id] ?? 0) : 0

    const peerScores = employees
      .filter((peer) => peer.id !== employee.id)
      .map((peer) => {
        if (!submissions[peer.id]?.usedVotingRight) {
          return null
        }

        return employeeScores[peer.id]?.[employee.id] ?? null
      })
      .filter((score): score is number => typeof score === 'number')

    const peerAverage =
      peerScores.length > 0
        ? round(peerScores.reduce((total, score) => total + score, 0) / peerScores.length)
        : 0

    const finalScore = round(
      leaderA * 0.3 + leaderB * 0.3 + selfScore * 0.1 + peerAverage * 0.3
    )

    return {
      employeeId: employee.id,
      name: employee.name,
      department: employee.department,
      peerAverage,
      finalScore,
      rank: 0,
      usedVotingRight: submission?.usedVotingRight ?? false,
      isBottomTwo: false
    }
  })

  const ranked = [...results]
    .sort((left, right) => right.finalScore - left.finalScore)
    .map((result, index, source) => ({
      ...result,
      rank: index + 1,
      isBottomTwo: index >= Math.max(source.length - 2, 0)
    }))

  return ranked
}

export function computeCycleSummary(
  results: EmployeeResult[],
  submissions: Record<string, EmployeeSubmission>
): CycleSummary {
  const submittedCount = Object.values(submissions).filter((item) => item.submittedAt).length
  const validVotingCount = Object.values(submissions).filter((item) => item.usedVotingRight).length
  const pendingCount = Object.values(submissions).filter((item) => !item.submittedAt).length
  const averageScore =
    results.length > 0
      ? round(results.reduce((total, item) => total + item.finalScore, 0) / results.length)
      : 0
  const bottomTwoNames = results
    .slice(-2)
    .map((item) => item.name)
    .join('、')

  return {
    employeeCount: results.length,
    submittedCount,
    validVotingCount,
    pendingCount,
    averageScore,
    bottomTwoNames,
    isPublicVisible: false,
    currentLabel: '未设置周期',
    currentPeriodText: '暂无周期时间',
    publicLabel: '未设置周期',
    workLabel: '未设置周期',
    stageLabel: '未设置阶段',
    deadlineExact: '未设置截止时间',
    deadlineAt: null
  }
}
