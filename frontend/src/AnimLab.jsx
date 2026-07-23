import { useState } from 'react'
import SHIELDS from './shields.json'
import { INSTRUMENTS, ShieldChip } from './RiskPanel.jsx'

// Dev-only animation lab (#/lab): instruments loop forever here so the
// working-state animations can be reviewed and tuned without re-running a
// scenario. Not linked from any customer screen.

const KEYS = ['context', 'biometric', 'behavior', 'transaction']

const SAMPLE_STEPS = {
  context: [
    'Escalated payment — staged evaluation',
    'Initial read (80/100): Major rail hub at midnight is unusual for this customer.',
    'Tool call: location service (mock) → home distance, location history',
  ],
  biometric: [
    'Consent check → granted',
    'Initial read (65/100): Heart rate significantly elevated above baseline (118 vs 62).',
    'Tool call: HealthKit (mock) → respiration, skin temp, activity state',
  ],
  behavior: [
    'Loaded behavior slice',
    'mouse_path_linearity is within the customer’s baseline range',
    'Tool call: session recorder (mock) → typing cadence, hesitation, field fill',
  ],
  transaction: [
    'Escalated payment — staged evaluation',
    'Initial read (65/100): Payee is new and the amount exceeds the typical range.',
    'Tool call: ledger service (mock) → 24h velocity, balance share',
  ],
}

export default function AnimLab() {
  const [active, setActive] = useState('context')
  const Instrument = INSTRUMENTS[active]
  return (
    <div className="panel-page">
      <div className="panel-inner">
        <div className="panel-brand">
          <h1>NeuroSecure</h1>
          <span className="pb-badge">ANIMATION LAB</span>
        </div>
        <p className="panel-sub">
          Working-state instruments loop forever here. Pick a shield, watch it
          run, give feedback — hot reload applies tweaks without restarting.
        </p>

        <div className="panel-section-title">Shield</div>
        <div className="lab-tabs">
          {KEYS.map((k) => (
            <button
              key={k}
              className={`lab-tab${active === k ? ' active' : ''}`}
              onClick={() => setActive(k)}
            >
              {SHIELDS[k].label}
            </button>
          ))}
        </div>

        <div className="panel-section-title">Card at real size</div>
        <div className="lab-stage">
          <div className={`agent-card spawn shield-${active} working`}>
            <div className="ac-top">
              <span className="ac-head">
                <ShieldChip shield={active} />
                <span>
                  <span className="ac-name">{SHIELDS[active].label}</span>
                  <span className="ac-desc">{SHIELDS[active].tagline}</span>
                  <span className="ac-invoked">↳ Sentinel invoked this shield for review.</span>
                </span>
              </span>
              <span className="ac-analyzing">Working…</span>
            </div>
            <ul className="ac-steps">
              {SAMPLE_STEPS[active].map((text, i) => (
                <li key={i} className={i === SAMPLE_STEPS[active].length - 1 ? 'latest' : ''}>{text}</li>
              ))}
            </ul>
            <Instrument />
          </div>
        </div>

        <div className="panel-section-title">Instrument at 2.4×</div>
        <div className="lab-stage lab-zoom">
          <Instrument />
        </div>
      </div>
    </div>
  )
}
