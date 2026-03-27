import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const historyView = fs.readFileSync(
  path.resolve('src/views/HistoryArchiveView.vue'),
  'utf8'
)
const resultsView = fs.readFileSync(
  path.resolve('src/views/ResultsPublicView.vue'),
  'utf8'
)
const maskedSurface = fs.readFileSync(
  path.resolve('src/components/public/MaskedSurface.vue'),
  'utf8'
)

test('history archive layout uses a real grid sidebar with internal scrolling', () => {
  assert.match(historyView, /<TableSection[\s\S]*class="archive-sidebar"/)
  assert.match(historyView, /\.archive-layout\s*\{[\s\S]*display:\s*grid;/)
  assert.match(historyView, /\.archive-list\s*\{[\s\S]*overflow-y:\s*auto;/)
})

test('public results page preserves masked placeholder structure instead of rendering empty compressed shells', () => {
  assert.match(resultsView, /maskedPlaceholderCount/)
  assert.match(resultsView, /const matrixColumns = computed/)
  assert.match(resultsView, /const matrixRows = computed/)
})

test('masked surface guarantees enough height for centered veil copy', () => {
  assert.match(maskedSurface, /min-height:\s*11rem/)
  assert.match(maskedSurface, /min-height:\s*9\.5rem/)
})
