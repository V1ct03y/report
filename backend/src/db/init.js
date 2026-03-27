import { db } from './client.js'
import { hashPassword } from '../utils/crypto.js'
import {
  currentSqlTimestamp,
  ensurePlannedCycleWindow,
  safeEnsureCycleColumns,
  seedWeeklyCycles
} from '../services/cycle-lifecycle.service.js'
import { saveEmployeeScores, saveManagerScores } from '../services/score.service.js'
import { settleCycle } from '../services/settlement.service.js'
import { archiveCycle, publishCycle } from '../services/cycle-control.service.js'

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('member', 'leader', 'admin')),
  force_password_change INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rating_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed', 'settled')),
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  rater_user_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  score REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, rater_user_id, target_user_id),
  FOREIGN KEY(cycle_id) REFERENCES rating_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY(rater_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_score_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  required_count INTEGER NOT NULL DEFAULT 0,
  used_voting_right INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, user_id),
  FOREIGN KEY(cycle_id) REFERENCES rating_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS manager_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  manager_user_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  score REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, manager_user_id, target_user_id),
  FOREIGN KEY(cycle_id) REFERENCES rating_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY(manager_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlement_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  self_score REAL NOT NULL DEFAULT 0,
  self_score_valid INTEGER NOT NULL DEFAULT 0,
  peer_average_score REAL NOT NULL DEFAULT 0,
  manager_a_score REAL NOT NULL DEFAULT 0,
  manager_b_score REAL NOT NULL DEFAULT 0,
  final_score REAL NOT NULL DEFAULT 0,
  rank_position INTEGER NOT NULL,
  is_bottom_two INTEGER NOT NULL DEFAULT 0,
  used_voting_right INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, user_id),
  FOREIGN KEY(cycle_id) REFERENCES rating_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cycle_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  is_participant INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cycle_id, user_id),
  FOREIGN KEY(cycle_id) REFERENCES rating_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`

const DEMO_EMPLOYEE_SCORE_BOOK = {
  1: {
    zhangsan: { zhangsan: 98, lisi: 94, wangwu: 92, zhaoliu: 90 },
    lisi: { zhangsan: 95, lisi: 97, wangwu: 91, zhaoliu: 88 },
    wangwu: { zhangsan: 93, lisi: 90, wangwu: 96, zhaoliu: 87 },
    zhaoliu: { zhangsan: 91, lisi: 89, wangwu: 88, zhaoliu: 95 }
  },
  2: {
    zhangsan: { zhangsan: 96, lisi: 92, wangwu: 89, zhaoliu: 86 },
    lisi: { zhangsan: 93, lisi: 95, wangwu: 90, zhaoliu: 87 },
    wangwu: { zhangsan: 90, lisi: 88, wangwu: 94, zhaoliu: 85 },
    zhaoliu: { zhangsan: 88, lisi: 86, wangwu: 84, zhaoliu: 92 }
  }
}

const DEMO_MANAGER_SCORE_BOOK = {
  1: {
    'leader-a': { zhangsan: 96, lisi: 93, wangwu: 90, zhaoliu: 87 },
    'leader-b': { zhangsan: 95, lisi: 92, wangwu: 89, zhaoliu: 86 }
  },
  2: {
    'leader-a': { zhangsan: 94, lisi: 91, wangwu: 88, zhaoliu: 85 },
    'leader-b': { zhangsan: 93, lisi: 90, wangwu: 87, zhaoliu: 84 }
  }
}

function addMinutesToSqlTime(raw, minutes) {
  const date = new Date(String(raw).replace(' ', 'T'))
  return currentSqlTimestamp(new Date(date.getTime() + minutes * 60 * 1000))
}

function seedAcceptanceHistoryData() {
  const historyCycles = db.prepare(`
    SELECT id, week_number, end_at
    FROM rating_cycles
    WHERE week_number IN (1, 2)
    ORDER BY week_number ASC
  `).all()

  if (historyCycles.length !== 2) return

  const existingResults = db.prepare(`
    SELECT COUNT(*) AS count
    FROM settlement_results
    WHERE cycle_id IN (?, ?)
  `).get(historyCycles[0].id, historyCycles[1].id).count

  if (existingResults > 0) return

  const users = db.prepare(`
    SELECT id, username
    FROM users
    WHERE username IN ('leader-a', 'leader-b', 'zhangsan', 'lisi', 'wangwu', 'zhaoliu')
    ORDER BY id ASC
  `).all()
  const userByUsername = new Map(users.map((user) => [user.username, user]))

  const resetCycleData = db.transaction((cycleId) => {
    db.prepare('DELETE FROM settlement_results WHERE cycle_id = ?').run(cycleId)
    db.prepare('DELETE FROM employee_scores WHERE cycle_id = ?').run(cycleId)
    db.prepare('DELETE FROM employee_score_submissions WHERE cycle_id = ?').run(cycleId)
    db.prepare('DELETE FROM manager_scores WHERE cycle_id = ?').run(cycleId)
    db.prepare('DELETE FROM cycle_participants WHERE cycle_id = ?').run(cycleId)
    db.prepare(`
      UPDATE rating_cycles
      SET status = 'closed',
          settled_at = NULL,
          public_at = NULL,
          published_at = NULL,
          archived_at = NULL,
          is_archived = 0,
          settle_mode = 'automatic',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cycleId)
  })

  for (const cycle of historyCycles) {
    resetCycleData(cycle.id)

    const employeeBook = DEMO_EMPLOYEE_SCORE_BOOK[cycle.week_number] || {}
    for (const [raterUsername, scoreMap] of Object.entries(employeeBook)) {
      const rater = userByUsername.get(raterUsername)
      if (!rater) continue
      saveEmployeeScores(
        cycle.id,
        rater.id,
        Object.entries(scoreMap).map(([targetUsername, score]) => ({
          targetUserId: userByUsername.get(targetUsername)?.id,
          score
        })).filter((item) => Number.isFinite(item.targetUserId))
      )
    }

    const managerBook = DEMO_MANAGER_SCORE_BOOK[cycle.week_number] || {}
    for (const [leaderUsername, scoreMap] of Object.entries(managerBook)) {
      const leader = userByUsername.get(leaderUsername)
      if (!leader) continue
      saveManagerScores(
        cycle.id,
        leader.id,
        Object.entries(scoreMap).map(([targetUsername, score]) => ({
          targetUserId: userByUsername.get(targetUsername)?.id,
          score
        })).filter((item) => Number.isFinite(item.targetUserId))
      )
    }

    settleCycle(cycle.id, 'automatic', cycle.end_at)
    publishCycle(cycle.id, cycle.end_at)
    archiveCycle(cycle.id, addMinutesToSqlTime(cycle.end_at, 30))
  }
}

function ensureUserRoleModel() {
  const userTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
  if (!userTable?.sql) return

  const hasLegacyRoles = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role IN ('employee', 'manager')").get().count > 0
  const hasNewConstraint = userTable.sql.includes("role IN ('member', 'leader', 'admin')")
  if (!hasLegacyRoles && hasNewConstraint) return

  const tx = db.transaction(() => {
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec('ALTER TABLE users RENAME TO users_legacy')

    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('member', 'leader', 'admin')),
        force_password_change INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    db.exec(`
      INSERT INTO users (id, username, full_name, password_hash, role, force_password_change, is_active, created_at, updated_at)
      SELECT id,
             username,
             full_name,
             password_hash,
             CASE
               WHEN role = 'employee' THEN 'member'
               WHEN role = 'manager' THEN 'leader'
               ELSE role
             END,
             force_password_change,
             is_active,
             created_at,
             updated_at
      FROM users_legacy
    `)

    db.exec('DROP TABLE users_legacy')
    db.exec('PRAGMA foreign_keys = ON')
  })

  tx()
}

db.exec(schema)
ensureUserRoleModel()
safeEnsureCycleColumns()

const cycleCount = db.prepare('SELECT COUNT(*) as count FROM rating_cycles').get().count

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count
if (userCount === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, full_name, password_hash, role, force_password_change) VALUES (?, ?, ?, ?, ?)')
  const defaultPassword = hashPassword('ChangeMe123!')

  insertUser.run('kwok-admin', 'Kwok Admin', defaultPassword, 'admin', 0)
  insertUser.run('leader-a', '组长A', defaultPassword, 'leader', 1)
  insertUser.run('leader-b', '组长B', defaultPassword, 'leader', 1)
  insertUser.run('zhangsan', '张三', defaultPassword, 'member', 1)
  insertUser.run('lisi', '李四', defaultPassword, 'member', 1)
  insertUser.run('wangwu', '王五', defaultPassword, 'member', 1)
  insertUser.run('zhaoliu', '赵六', defaultPassword, 'member', 1)
}

seedWeeklyCycles()
if (cycleCount <= 1) {
  seedAcceptanceHistoryData()
}
ensurePlannedCycleWindow(20)

console.log('Database initialized.')
