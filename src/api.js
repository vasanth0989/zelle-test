// Real backend wiring (Phase 4): POST api/evaluate → open the SSE stream and
// forward v2 events (step / result / adjudication) to onEvent. URLs RELATIVE
// (hard rule). Returns a cancel function that closes the stream.
// No silent mock fallback: if the server is unreachable, onError fires and the
// UI shows a retry state — a dead backend must never look like a live one.
export function evaluate(payload, onEvent, onError) {
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
  const res = await fetch('api/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId, grant }),
  })
  if (!res.ok) throw new Error(`respond ${res.status}`)
  return res.json()
}

export async function setScenario(name) {
  const res = await fetch('api/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`scenario ${res.status}`)
  return res.json()
}

export async function getScenario() {
  const res = await fetch('api/scenario')
  if (!res.ok) throw new Error(`scenario ${res.status}`)
  return res.json()
}
