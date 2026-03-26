import type { Account, Employee, EmployeeScoreBook, EmployeeSubmission, Leader, LeaderScoreBook } from '../types'

export const employees: Employee[] = [
  { id: 'e1', name: '陈雨', title: '产品运营', department: '运营中心' },
  { id: 'e2', name: '李柯', title: '财务专员', department: '财务部' },
  { id: 'e3', name: '王宁', title: '销售经理', department: '销售部' },
  { id: 'e4', name: '赵岚', title: 'HRBP', department: '人力资源部' },
  { id: 'e5', name: '周宁', title: '项目助理', department: '项目管理部' },
  { id: 'e6', name: '孙可', title: '采购专员', department: '采购部' }
]

export const leaders: Leader[] = [
  { id: 's1', name: '顾凡', label: '组长A' },
  { id: 's2', name: '许舟', label: '组长B' }
]

export const accounts: Account[] = [
  {
    id: 'a-emp-1',
    username: 'chenyu',
    password: 'Temp#1234',
    displayName: '陈雨',
    role: 'member',
    roleLabel: '成员',
    linkedEmployeeId: 'e1',
    firstLogin: true
  },
  {
    id: 'a-emp-2',
    username: 'like',
    password: 'Demo#1234',
    displayName: '李柯',
    role: 'member',
    roleLabel: '成员',
    linkedEmployeeId: 'e2',
    firstLogin: false
  },
  {
    id: 'a-sup-1',
    username: 'leaderA',
    password: 'Demo#1234',
    displayName: '顾凡',
    role: 'leader',
    roleLabel: '组长A',
    linkedLeaderId: 's1',
    firstLogin: false
  },
  {
    id: 'a-sup-2',
    username: 'leaderB',
    password: 'Demo#1234',
    displayName: '许舟',
    role: 'leader',
    roleLabel: '组长B',
    linkedLeaderId: 's2',
    firstLogin: false
  },
  {
    id: 'a-admin',
    username: 'admin',
    password: 'Demo#1234',
    displayName: '结算管理员',
    role: 'admin',
    roleLabel: '后台管理员',
    firstLogin: false
  }
]

export const initialEmployeeScores: EmployeeScoreBook = {
  e1: { e1: null, e2: null, e3: null, e4: null, e5: null, e6: null },
  e2: { e1: 89, e2: 92, e3: 90, e4: 88, e5: 84, e6: 87 },
  e3: { e1: 93, e2: 90, e3: 95, e4: 89, e5: 86, e6: 91 },
  e4: { e1: 91, e2: 88, e3: 89, e4: 94, e5: 85, e6: 90 },
  e5: { e1: 83, e2: null, e3: 82, e4: null, e5: 86, e6: 80 },
  e6: { e1: 88, e2: 87, e3: 90, e4: 92, e5: 84, e6: 91 }
}

export const initialLeaderScores: LeaderScoreBook = {
  s1: { e1: 90, e2: 93, e3: 94, e4: 89, e5: 82, e6: 88 },
  s2: { e1: 92, e2: 91, e3: 95, e4: 90, e5: 84, e6: 87 }
}

export const initialSubmissions: Record<string, EmployeeSubmission> = {
  e1: { usedVotingRight: false, submittedAt: null },
  e2: { usedVotingRight: true, submittedAt: '2026-03-25 10:20' },
  e3: { usedVotingRight: true, submittedAt: '2026-03-25 10:35' },
  e4: { usedVotingRight: true, submittedAt: '2026-03-25 10:46' },
  e5: { usedVotingRight: false, submittedAt: '2026-03-25 11:05' },
  e6: { usedVotingRight: true, submittedAt: '2026-03-25 11:18' }
}
