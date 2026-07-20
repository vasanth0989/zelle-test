// Tab 2 — control panel shell. Phase 4 wires these cards to POST api/scenario.
const SCENARIOS = [
  { name: 'normal', title: 'Normal', blurb: 'Routine daytime payment to a known payee. Expect: allow.' },
  { name: 'coerced', title: 'Coerced at night', blurb: 'Elevated stress, 1 AM, transit hub, first-seen payee. Expect: step_up.' },
  { name: 'bot', title: 'Automation / bot', blurb: 'Machine-perfect input cadence, remote-access pattern. Expect: pause.' },
  { name: 'workout', title: 'Post-workout', blurb: 'High heart rate explained by activity. Expect: allow.' },
]

export default function Panel() {
  return (
    <div className="panel-page">
      <div className="panel-inner">
        <div className="panel-brand">
          <h1>NeuroSecure</h1>
          <span className="pb-badge">CONTROL PANEL</span>
        </div>
        <p className="panel-sub">
          Scenario picker for the live demo. Selecting a card sets the active sensor
          fixture on the server; the banking app in Tab&nbsp;1 stays untouched.
        </p>
        <div className="scenario-grid">
          {SCENARIOS.map((s) => (
            <button key={s.name} className="scenario-card" disabled title="Wired up in Phase 4">
              <h3>{s.title}</h3>
              <p>{s.blurb}</p>
            </button>
          ))}
        </div>
        <p className="panel-note">
          Shell only for now — scenario switching goes live in Phase&nbsp;4 when the
          FastAPI backend lands (POST api/scenario).
        </p>
      </div>
    </div>
  )
}
