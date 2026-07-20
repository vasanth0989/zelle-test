import { mockEvaluate } from './mock.js'

// POST the payload to the (future) backend — RELATIVE URL, hard rule — and
// drive the UX from the mock. Phase 4 swaps the mock for the real SSE stream;
// until then the POST is fire-and-forget so the wire shape is exercised early.
export function evaluate(payload, onEvent) {
  fetch('api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
  return mockEvaluate(payload, onEvent)
}
