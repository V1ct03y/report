import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: Number(process.env.PORT || 4300),
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  dbPath: process.env.DB_PATH || './data/app.db'
}
