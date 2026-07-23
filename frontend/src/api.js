// API layer with two modes (config.js, runtime-switchable via the rail toggle):
// - mock mode → everything is served by mock.js (scripted tapes,
//   scenario sync over BroadcastChannel). The UI runs with NO backend.
// - real mode → real backend wiring: POST api/evaluate → SSE
//   stream of v2.2 events. URLs RELATIVE (hard rule). No silent fallback:
//   a dead backend must never look like a live one.
// isMock() is read PER CALL, so flipping the toggle applies to the next run.
import { isMock } from './config.js'
import { mockEvaluate, mockRespond, mockGetScenario, mockSetScenario } from './mock.js'

export function evaluate(payload, onEvent, onError) {
  if (isMock()) return mockEvaluate(payload, onEvent)

  let source = null
  let cancelled = false

  fetch('api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`evaluate ${res.status}`)
      return res.json()
    })
    .then(({ run_id }) => {
      if (cancelled) return
      onEvent({ type: 'run_started', run_id })
      source = new EventSource(`api/stream?run_id=${run_id}`)
      source.onmessage = (e) => {
        const evt = JSON.parse(e.data)
        if (evt.type === 'adjudication') source.close() // run complete
        onEvent(evt)
      }
      source.onerror = () => {
        source.close()
        if (!cancelled) onError?.()
      }
    })
    .catch(() => {
      if (!cancelled) onError?.()
    })

  return () => {
    cancelled = true
    source?.close()
  }
}

// Answer a mid-run consent_request (the Adjudicator is waiting on this).
export async function respond(runId, grant) {
  if (isMock()) return mockRespond(runId, grant)
  const res = await fetch('api/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId, grant }),
  })
  if (!res.ok) throw new Error(`respond ${res.status}`)
  return res.json()
}

export async function setScenario(name) {
  if (isMock()) return mockSetScenario(name)
  const res = await fetch('api/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`scenario ${res.status}`)
  return res.json()
}

export async function getScenario() {
  if (isMock()) return mockGetScenario()
  const res = await fetch('api/scenario')
  if (!res.ok) throw new Error(`scenario ${res.status}`)
  return res.json()
}
