import { db } from '../db/client.js'
import { hashPassword } from '../utils/crypto.js'

export function listMembers() {
  return db.prepare("SELECT id, username, full_name, role, is_active, created_at FROM users WHERE role = 'member' ORDER BY id ASC").all()
}

export function createMember({ username, fullName, password }) {
  const stmt = db.prepare('INSERT INTO users (username, full_name, password_hash, role, force_password_change, is_active) VALUES (?, ?, ?, \'member\', 1, 1)')
  const result = stmt.run(username, fullName, hashPassword(password || 'ChangeMe123!'))
  return db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid)
}

export function deleteMember(userId) {
  db.prepare("UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'member'").run(userId)
  return { success: true }
}
