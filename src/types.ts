export type Role = 'member' | 'leader' | 'admin'

export interface Employee {
  id: string
  name: string
  title: string
  department: string
}

export interface Leader {
  id: string
  name: string
  label: string
}

export interface Account {
  id: string
  username: string
  password?: string
  displayName: string
  role: Role
  roleLabel: string
  linkedEmployeeId?: string
  linkedLeaderId?: string
  firstLogin: boolean
}

export interface EmployeeSubmission {
  usedVotingRight: boolean
  submittedAt: string | null
}

export type CycleStatus = 'draft' | 'active' | 'closed' | 'settled'
export type ScoreMap = Record<string, number | null>
export type EmployeeScoreBook = Record<string, ScoreMap>
export type LeaderScoreBook = Record<string, Record<string, number>>

export interface CycleRecord {
  id: number
  name: string
  week_number: number | null
  start_at: string | null
  end_at: string | null
  status: CycleStatus
  settled_at: string | null
  settle_mode: 'manual' | 'automatic' | null
  public_at: string | null
  is_archived: number
}

export interface CycleOverview {
  publicCycle: CycleRecord | null
  workCycle: CycleRecord | null
  displayCycle: CycleRecord | null
  upcomingCycle: CycleRecord | null
  history: CycleRecord[]
}

export interface EmployeeResult {
  employeeId: string
  name: string
  department: string
  peerAverage: number
  finalScore: number
  rank: number
  usedVotingRight: boolean
  isBottomTwo: boolean
}

export interface CycleSummary {
  employeeCount: number
  submittedCount: number
  validVotingCount: number
  pendingCount: number
  averageScore: number
  bottomTwoNames: string
  isPublicVisible: boolean
  currentLabel: string
  currentPeriodText: string
  publicLabel: string
  workLabel: string
  stageLabel: string
  deadlineExact: string
  deadlineAt: string | null
}

export interface MemberRecord {
  id: number
  username: string
  full_name: string
  role: Role
  is_active: number
  is_participant?: number
  created_at?: string
  completed_count?: number
  required_count?: number
  used_voting_right?: number
  submitted_at?: string | null
}

export interface PublicMatrixRow {
  rowLabel: string
  employeeId: string
  values: Array<number | false | null>
  valid?: boolean
}
