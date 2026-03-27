import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routerSource = fs.readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const appSource = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')

test('reset-password route opts out of app shell', () => {
  assert.match(
    routerSource,
    /path:\s*'\/reset-password'[\s\S]*meta:\s*\{[\s\S]*shell:\s*false/
  )
})

test('authless panel supports a wide layout variant for reset-password flow', () => {
  assert.match(appSource, /authless-panel--wide/)
  assert.match(appSource, /route\.meta\.authlessWide/)
})
