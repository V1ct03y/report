import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/env.js'
import { healthRouter } from './routes/health.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { employeeRouter } from './routes/employee.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { cycleRouter } from './routes/cycle.routes.js'
import './db/init.js'
import { startScheduler } from './services/scheduling.service.js'
import { pathToFileURL } from 'node:url'

export const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/employee', employeeRouter)
app.use('/api/admin', adminRouter)
app.use('/api/cycles', cycleRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: '服务器内部错误' })
})

export function startServer() {
  return app.listen(env.port, () => {
    console.log(`API running at http://localhost:${env.port}`)
  })
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  startServer()
  startScheduler()
}
