import { useEffect, useRef, useState } from 'react'

// Tab 2 — control panel. Display mode is live NOW (synced to the banking tab
// via BroadcastChannel — in-memory messaging, no storage). Scenario cards get
// wired to POST api/scenario in Phase 4.
const SCENARIOS = [
  { name: 'normal', title: 'Normal', blurb: 'Routine daytime payment to a known payee. Expect: allow.' },
  { name: 'coerced', title: 'Coerced at night', blurb: 'Elevated stress, 1 AM, transit hub, first-seen payee. Expect: step_up.' },
  { name: 'bot', title: 'Automation / bot', blurb: 'Machine-perfect input cadence, remote-access pattern. Expect: pause.' },
  { name: 'workout', title: 'Post-workout', blurb: 'High heart rate explained by activity. Expect: allow.' },
  { name: 'no_consent', title: 'No biometric consent', blurb: 'Consent declined, borderline signals. Expect: step_up offering one-time permission.' },
]

export default function Panel() {
  const [mode, setMode] = useState('live')
  const channel = useRef(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    const ch = new BroadcastChannel('neurosecure-ctl')
    channel.current = ch
    // Late-joining banking tabs ask for the current mode.
    ch.onmessage = (e) => {
      if (e.data?.type === 'request_mode') {
        ch.postMessage({ type: 'display_mode', mode: modeRef.current })
      }
    }
    return () => ch.close()
  }, [])

  useEffect(() => {
    channel.current?.postMessage({ type: 'display_mode', mode })
  }, [mode])

  return (
    <div className="panel-page">
      <div className="panel-inner">
        <div className="panel-brand">
          <h1>NeuroSecure</h1>
          <span className="pb-badge">CONTROL PANEL</span>
        </div>
        <p className="panel-sub">
          Demo controls for the live pitch. The banking app runs in Tab&nbsp;1;
          changes here apply to it instantly.
        </p>

        <div className="panel-section-title">Display mode</div>
        <div className="mode-toggle">
          <button
            className={mode === 'live' ? 'active' : ''}
            onClick={() => setMode('live')}
          >
            LIVE stream
            <span>shield cards flip as events land</span>
          </button>
          <button
            className={mode === 'spinner' ? 'active' : ''}
            onClick={() => setMode('spinner')}
          >
            Spinner
            <span>calm fallback — all results at once</span>
          </button>
        </div>
        <p className="panel-hint">
          Active: <strong>{mode === 'live' ? 'LIVE stream' : 'Spinner'}</strong> — applies
          to the next evaluation in the banking tab.
        </p>

        <div className="panel-section-title">Scenario</div>
        <div className="scenario-grid">
          {SCENARIOS.map((s) => (
            <button key={s.name} className="scenario-card" disabled title="Wired up in Phase 4">
              <h3>{s.title}</h3>
              <p>{s.blurb}</p>
            </button>
          ))}
        </div>
        <p className="panel-note">
          Scenario switching goes live in Phase&nbsp;4 with the FastAPI backend
          (POST api/scenario). Until then, edit MOCK_DECISION in frontend/src/mock.js.
        </p>
      </div>
    </div>
  )
}
