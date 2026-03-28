import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { pathToFileURL } from 'node:url'

dotenv.config()

function parseArgs(argv = process.argv.slice(2)) {
  const modeArg = argv.find((item) => item === 'production' || item === 'acceptance')
  return {
    mode: modeArg || 'production',
    reset: argv.includes('--reset')
  }
}

function resolveDbPath() {
  return path.resolve(process.cwd(), process.env.DB_PATH || './data/app.db')
}

function removeDbArtifacts(dbPath) {
  for (const target of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true })
    }
  }
}

async function runInitialization(options = {}) {
  const { mode, reset } = { ...parseArgs(), ...options }
  const dbPath = resolveDbPath()

  try {
    if (reset) {
      removeDbArtifacts(dbPath)
    }

    const { initializeDatabase } = await import('./bootstrap.js')
    initializeDatabase({ mode })
    console.log(`Database initialized (${mode}).`)
  } catch (error) {
    if (reset && error?.code === 'EPERM') {
      console.error(`Unable to reset database at ${dbPath}. Stop the backend service and retry.`)
      process.exitCode = 1
      return
    }

    throw error
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  await runInitialization()
} else {
  await runInitialization({ mode: 'production', reset: false })
}

export { runInitialization }
