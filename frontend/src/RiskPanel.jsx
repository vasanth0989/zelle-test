import { useEffect, useState } from 'react'
import SHIELDS from './shields.json'

// Typewriter reveal for rationales (LIVE mode). Fast and subtle — ~80 chars/s.
function TypeText({ text, instant }) {
  const [shown, setShown] = useState(instant ? text.length : 0)
  useEffect(() => {
    if (instant) { setShown(text.length); return }
    setShown(0)
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) { clearInterval(id); return n }
        return n + 2
      })
    }, 24)
    return () => clearInterval(id)
  }, [text, instant])
  return <>{text.slice(0, shown)}</>
}

// Shield risk panel: cards show live step lines as SSE step events land, then
// flip to score + rationale; the Adjudicator verdict lands last as a banner.

const SHIELD_KEYS = ['transaction', 'context', 'biometric', 'behavior']

const DECISION_LABEL = {
  allow: 'Payment approved',
  step_up: 'Let’s verify a few things',
  pause: 'Payment paused for your protection',
}

function band(result) {
  if (result.consent_declined) return 'declined'
  return result.score >= 70 ? 'high' : result.score >= 40 ? 'mid' : 'low'
}

const PROCEED_LABEL = {
  allow: 'Continue',
  step_up: 'Continue to verification',
  pause: 'See details',
}

export default function RiskPanel({ results, steps, adjudication, instant = false, onProceed }) {
  return (
    <div className="risk-panel">
      <p className="rp-sub">Our security shields are reviewing this transfer in real time.</p>
      {SHIELD_KEYS.map((key) => {
        const r = results[key]
        const lines = steps[key] || []
        return (
          <div key={key} className={`agent-card${r ? ' done' : ''}`}>
            <div className="ac-top">
              <span>
                <span className="ac-name">{SHIELDS[key].label}</span>
                <span className="ac-desc">{SHIELDS[key].tagline}</span>
              </span>
              {r
                ? <span className={`score-pill ${band(r)}`}>{r.consent_declined ? '—' : r.score}</span>
                : <span className="ac-analyzing">{lines.length ? 'Working…' : 'Analyzing…'}</span>}
            </div>
            {lines.length > 0 && (
              <ul className="ac-steps">
                {lines.map((text, i) => <li key={i}>{text}</li>)}
              </ul>
            )}
            {r
              ? (
                <p className="ac-rationale">
                  <TypeText text={r.rationale} instant={instant} />
                  <span className="ac-conf"> · {r.confidence} confidence</span>
                </p>
              )
              : lines.length === 0 && <div className="shimmer" />}
          </div>
        )
      })}
      {adjudication && (
        <div className={`adj-strip ${adjudication.decision}`}>
          <div className="adj-top">
            <strong>
              {adjudication.step_up_method === 'temporary_biometric_permission'
                ? 'One more option to complete this'
                : DECISION_LABEL[adjudication.decision]}
            </strong>
            <span className="adj-score">risk {adjudication.risk_score}</span>
          </div>
          <p>{adjudication.reasoning}</p>
        </div>
      )}
      {adjudication && onProceed && (
        <button className="btn-continue rp-proceed" onClick={onProceed}>
          {PROCEED_LABEL[adjudication.decision]}
        </button>
      )}
      <p className="rp-brand">Protected by NeuroSecure</p>
    </div>
  )
}
