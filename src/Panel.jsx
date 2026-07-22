import { useEffect, useRef, useState } from 'react'
import { getScenario, setScenario } from './api.js'

// Tab 2 — control panel. Scenario cards drive POST api/scenario on the real
// backend; display mode stays client-side (BroadcastChannel to the banking
// tab — in-memory messaging, no storage).
const SCENARIOS = [
  { name: 'normal', title: 'Normal', blurb: 'Routine daytime payment to a known payee. Expect: allow.' },
  { name: 'coerced', title: 'Coerced at night', blurb: 'Elevated stress, 1 AM, transit hub, first-seen payee. Expect: step_up.' },
  { name: 'bot', title: 'Automation / bot', blurb: 'Machine-perfect input cadence, remote-access pattern. Expect: pause.' },
  { name: 'workout', title: 'Post-workout', blurb: 'High heart rate explained by activity. Expect: allow.' },
  { name: 'no_consent', title: 'No biometric consent', blurb: 'Consent declined, borderline signals. Expect: step_up offering one-time permission.' },
]

export default function Panel() {
  const [mode, setMode] = useState('live')
  const [dev, setDev] = useState(false)        // developer overlay on the shield cards
  const [active, setActive] = useState(null)   // active scenario on the server
  const [backendUp, setBackendUp] = useState(null) // null = checking
  const channel = useRef(null)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const devRef = useRef(dev)
  devRef.current = dev

  useEffect(() => {
    getScenario()
      .then((r) => { setActive(r.active); setBackendUp(true) })
      .catch(() => setBackendUp(false))
  }, [])

  function pickScenario(name) {
    setScenario(name)
      .then((r) => { setActive(r.active); setBackendUp(true) })
      .catch(() => setBackendUp(false))
  }

  useEffect(() => {
    const ch = new BroadcastChannel('neurosecure-ctl')
    channel.current = ch
    // Late-joining banking tabs ask for the current mode.
    ch.onmessage = (e) => {
      if (e.data?.type === 'request_mode') {
        ch.postMessage({ type: 'display_mode', mode: modeRef.current })
        ch.postMessage({ type: 'dev_mode', on: devRef.current })
      }
    }
    return () => ch.close()
  }, [])

  useEffect(() => {
    channel.current?.postMessage({ type: 'display_mode', mode })
  }, [mode])

  useEffect(() => {
    channel.current?.postMessage({ type: 'dev_mode', on: dev })
  }, [dev])

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

        <div className="panel-section-title">Developer overlay</div>
        <div className="mode-toggle">
          <button
            className={!dev ? 'active' : ''}
            onClick={() => setDev(false)}
          >
            Customer view
            <span>clean cards — no internals</span>
          </button>
          <button
            className={dev ? 'active' : ''}
            onClick={() => setDev(true)}
          >
            Developer view
            <span>models, escalation badges, timings</span>
          </button>
        </div>
        <p className="panel-hint">
          {dev
            ? 'Shield cards show the real model behind each agent, staged-escalation badges and per-shield timings.'
            : 'Flip to Developer view for the "what’s working behind the scenes" moment.'}
        </p>

        <div className="panel-section-title">Scenario</div>
        <div className="scenario-grid">
          {SCENARIOS.map((s) => (
            <button
              key={s.name}
              className={`scenario-card live${active === s.name ? ' active' : ''}`}
              onClick={() => pickScenario(s.name)}
            >
              <h3>{s.title}{active === s.name && <span className="sc-live-dot"> ● ACTIVE</span>}</h3>
              <p>{s.blurb}</p>
            </button>
          ))}
        </div>
        <p className="panel-note">
          {backendUp === false
            ? 'Backend unreachable — start it with: uvicorn backend.app:app --port 8000'
            : active
              ? `Server fixture: "${active}" — applies to the next evaluation in the banking tab.`
              : 'Checking backend…'}
        </p>
      </div>
    </div>
  )
}
