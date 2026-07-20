// Agent risk panel: four specialist cards flip from pending → score+rationale
// as results arrive; the adjudicator verdict lands last as a banner.

const AGENTS = [
  { key: 'transaction', label: 'Transaction Anomaly', desc: 'This payment vs. your history' },
  { key: 'biometric', label: 'Biometric Stress', desc: 'Wearable vital signs' },
  { key: 'context', label: 'Situational Context', desc: 'Location and time of day' },
  { key: 'behavior', label: 'Session Behavior', desc: 'Typing and cursor patterns' },
]

const DECISION_LABEL = {
  allow: 'Payment approved',
  step_up: 'Let’s verify a few things',
  pause: 'Payment paused for your protection',
}

function band(score) {
  return score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low'
}

export default function RiskPanel({ results, adjudicator }) {
  return (
    <div className="risk-panel">
      <p className="rp-sub">Our security agents are reviewing this transfer in real time.</p>
      {AGENTS.map(({ key, label, desc }) => {
        const r = results[key]
        return (
          <div key={key} className={`agent-card${r ? ' done' : ''}`}>
            <div className="ac-top">
              <span>
                <span className="ac-name">{label}</span>
                <span className="ac-desc">{desc}</span>
              </span>
              {r
                ? <span className={`score-pill ${band(r.score)}`}>{r.score}</span>
                : <span className="ac-analyzing">Analyzing…</span>}
            </div>
            {r
              ? <p className="ac-rationale">{r.rationale}<span className="ac-conf"> · {r.confidence} confidence</span></p>
              : <div className="shimmer" />}
          </div>
        )
      })}
      {adjudicator && (
        <div className={`adj-strip ${adjudicator.decision}`}>
          <div className="adj-top">
            <strong>{DECISION_LABEL[adjudicator.decision]}</strong>
            <span className="adj-score">risk {adjudicator.risk_score}</span>
          </div>
          <p>{adjudicator.reasoning}</p>
        </div>
      )}
      <p className="rp-brand">Protected by NeuroSecure</p>
    </div>
  )
}
