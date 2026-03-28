import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readPort(filePath, pattern) {
  const content = fs.readFileSync(path.join(root, filePath), 'utf8')
  const match = content.match(pattern)
  assert.ok(match, `Could not extract port from ${filePath}`)
  return Number(match[1])
}

test('Playwright baseURL uses the same frontend port as Vite dev server', () => {
  const vitePort = readPort('vite.config.ts', /port:\s*(\d+)/)
  const playwrightPort = readPort('playwright.config.ts', /baseURL:\s*'http:\/\/localhost:(\d+)'/)

  assert.equal(playwrightPort, vitePort)
})
