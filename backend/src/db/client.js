import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config/env.js'

const resolved = path.resolve(process.cwd(), env.dbPath)
fs.mkdirSync(path.dirname(resolved), { recursive: true })

export const db = new Database(resolved)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
