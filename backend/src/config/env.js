import dotenv from 'dotenv'

dotenv.config()

if (!process.env.TZ && process.env.APP_TIMEZONE) {
  process.env.TZ = process.env.APP_TIMEZONE
}

if (!process.env.TZ) {
  process.env.TZ = 'Asia/Hong_Kong'
}

export const env = {
  port: Number(process.env.PORT || 4300),
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  dbPath: process.env.DB_PATH || './data/app.db',
  timezone: process.env.TZ
}
