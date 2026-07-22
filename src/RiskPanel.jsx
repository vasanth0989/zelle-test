import { useEffect, useRef, useState } from 'react'
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

// Score pill count-up (~0.7s ease-out) when a card flips to done.
function CountUp({ value, instant }) {
  const [n, setN] = useState(instant ? value : 0)
  useEffect(() => {
    if (instant) { setN(value); return }
    let raf
    const t0 = performance.now()
    const dur = 700
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, instant])
  return <>{n}</>
}

// Risk meter inside the verdict strip: mounts at 0, CSS-transitions to value.
function RiskMeter({ value, instant }) {
  const [w, setW] = useState(instant ? value : 0)
  useEffect(() => {
    if (instant) { setW(value); return }
    const id = setTimeout(() => setW(value), 60)
    return () => clearTimeout(id)
  }, [value, instant])
  return (
    <div className="adj-meter"><div className="adj-meter-fill" style={{ width: `${w}%` }} /></div>
  )
}

// ---- Shield instruments: one live readout per signal channel. ----
// Red is reserved for the human vital (heart); everything mechanical is blue.

const HEART_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"

// Biometric: the pulse signal — a monitor trace drawing across with a
// glowing head, like a live heart-rate readout.
const ECG_PATH = "M0 14 H30 L38 14 44 5 50 23 56 9 60 14 H96 L104 14 110 5 116 23 122 9 126 14 H162 L170 14 176 5 182 23 188 9 192 14 H230"

function PulseInstrument() {
  return (
    <div className="instrument" aria-hidden="true">
      <svg className="inst-trace" viewBox="0 0 230 28" preserveAspectRatio="none">
        <path className="ecg-under" d={ECG_PATH} fill="none" />
        <path className="ecg-line" d={ECG_PATH} fill="none" pathLength="100" />
        <circle className="ecg-head" r="2.6">
          <animateMotion dur="2.6s" repeatCount="indefinite" path={ECG_PATH} />
        </circle>
      </svg>
    </div>
  )
}

// Context: radar dial sweeping the surroundings, waypoints checked in turn.
function RadarInstrument() {
  return (
    <div className="instrument" aria-hidden="true">
      <span className="inst-dial radar">
        <i className="radar-sweep" />
        <i className="radar-blip b1" />
        <i className="radar-blip b2" />
      </span>
      <span className="geo-line">
        <i className="geo-dot g1" />
        <i className="geo-dot g2" />
        <i className="geo-dot g3" />
      </span>
    </div>
  )
}

// Behavior: the cursor gliding along its captured path + keystroke cadence.
const CURSOR_TRAIL = "M4 20 C40 4, 74 26, 112 12 C150 -2, 190 24, 226 9"

function CursorInstrument() {
  return (
    <div className="instrument" aria-hidden="true">
      <svg className="inst-trace" viewBox="0 0 230 28" preserveAspectRatio="none">
        <path className="cursor-trail" d={CURSOR_TRAIL} fill="none" pathLength="100" />
        <circle className="cursor-dot" r="3">
          <animateMotion dur="3s" repeatCount="indefinite" path={CURSOR_TRAIL} />
        </circle>
      </svg>
      <span className="type-bars"><i /><i /><i /></span>
    </div>
  )
}

// Transaction: a lens sweeping the payment ledger — this payment examined
// against the history, entry by entry.
function LedgerInstrument() {
  return (
    <div className="instrument" aria-hidden="true">
      <span className="ledger-wrap">
        <svg className="ledger-rows" viewBox="0 0 230 28" preserveAspectRatio="none">
          <rect x="4" y="4" width="118" height="4" rx="2" />
          <rect x="198" y="4" width="28" height="4" rx="2" />
          <rect x="4" y="12" width="92" height="4" rx="2" />
          <rect x="198" y="12" width="28" height="4" rx="2" />
          <rect x="4" y="20" width="138" height="4" rx="2" />
          <rect x="198" y="20" width="28" height="4" rx="2" />
        </svg>
        <i className="ledger-glow" />
        <i className="ledger-lens" />
      </span>
    </div>
  )
}

export const INSTRUMENTS = {
  biometric: PulseInstrument,
  context: RadarInstrument,
  behavior: CursorInstrument,
  transaction: LedgerInstrument,
}

// Header identity chips — the same glyph vocabulary as the instruments.
export function ShieldChip({ shield, dim = false }) {
  const ink = '#ffffff'
  return (
    <span className={`shield-chip chip-${shield}${dim ? ' dim' : ''}`} aria-hidden="true">
      {shield === 'biometric' && (
        <svg viewBox="0 0 24 24" width="16" height="16" fill={ink}><path d={HEART_PATH} /></svg>
      )}
      {shield === 'context' && (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill={ink} stroke="none" />
        </svg>
      )}
      {shield === 'behavior' && (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      )}
      {shield === 'transaction' && (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )}
    </span>
  )
}

// Shield risk panel (Sentinel-routed, v2.2): the On-Device Sentinel card
// streams its routing decisions; shield cards MATERIALIZE when it invokes
// them, flip to score + rationale when their trace finishes, and skipped
// shields render as slim decision rows. The Adjudicator verdict lands last.

const SHIELD_KEYS = ['transaction', 'context', 'biometric', 'behavior']
const PACED_KEYS = ['sentinel', ...SHIELD_KEYS]

const DECISION_LABEL = {
  allow: 'Payment approved',
  step_up: 'Let’s verify a few things',
  pause: 'Payment paused for your protection',
}

function band(result) {
  if (result.consent_declined) return 'declined'
  return result.score >= 70 ? 'high' : result.score >= 40 ? 'mid' : 'low'
}

// Step glyph by content — tool fetches, consent gates, escalations and model
// reasoning read differently at a glance.
function stepKind(text) {
  if (text.startsWith('Tool call:')) return 'tool'
  if (text.startsWith('Consent check') || text.startsWith('Temporary permission')) return 'consent'
  if (text.startsWith('Escalated payment')) return 'escalate'
  if (text.startsWith('Initial read')) return 'initial'
  return 'note'
}

const PROCEED_LABEL = {
  allow: 'Continue',
  step_up: 'Continue to verification',
  pause: 'See details',
}

export default function RiskPanel({
  results, steps, adjudication, invocations = {}, shieldOrder = [], appearAfter = {},
  sentinelModel = null, instant = false, devMode = false, holdReason = null, onProceed,
}) {
  // Readable pacing ("queue and show it slowly"): step events arrive in bursts
  // — an LLM call returns several at once — so reveal at most one line per
  // agent per tick. Agents advance in parallel, which keeps every visible
  // card alive. `visible` counts revealed lines per agent key.
  const [visible, setVisible] = useState({})
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const timing = useRef({}) // shield -> {start, end} — client-measured, dev overlay only
  // Demo showcase: a working card holds its instrument on screen for at least
  // this long before it may flip to a score — fast LLM responses must not
  // vanish the theater. Skipped/declined cards are exempt (they never "work").
  const MIN_WORKING_MS = 5000
  const shownAt = useRef({})
  const [, setTick] = useState(0)

  useEffect(() => {
    if (instant) return
    const id = setInterval(() => setTick((t) => t + 1), 300)
    return () => clearInterval(id)
  }, [instant])

  useEffect(() => {
    if (instant) return
    // Cadence per agent: the Sentinel's decisions get a full beat so the
    // audience reads the WHY before anything acts on it; shield steps are a
    // touch quicker. The 120ms base tick just schedules the reveals.
    const CADENCE = { sentinel: 1100, default: 850 }
    const last = {}
    const id = setInterval(() => {
      const cur = stepsRef.current
      const now = performance.now()
      setVisible((v) => {
        let changed = false
        const next = { ...v }
        for (const k of PACED_KEYS) {
          const total = (cur[k] || []).length
          const cadence = CADENCE[k] ?? CADENCE.default
          if ((v[k] || 0) < total && (!last[k] || now - last[k] >= cadence)) {
            next[k] = (v[k] || 0) + 1
            last[k] = now
            changed = true
          }
        }
        return changed ? next : v
      })
    }, 120)
    return () => clearInterval(id)
  }, [instant])

  for (const k of SHIELD_KEYS) {
    if ((steps[k] || []).length && !timing.current[k]) timing.current[k] = { start: performance.now() }
    if (results[k] && timing.current[k] && !timing.current[k].end) timing.current[k].end = performance.now()
  }

  const shownCount = (k) => (instant ? (steps[k] || []).length : Math.min(visible[k] || 0, (steps[k] || []).length))
  const sentinelShown = shownCount('sentinel')
  // A card may only APPEAR once the sentinel line that caused it is on screen
  // (decision first, action second), flips only after its own trace has fully
  // played out AND its instrument has had its showcase, and the verdict strip
  // waits for everything — the finale never overtakes the theater.
  const cardVisible = (k) => instant || (appearAfter[k] ?? 0) <= sentinelShown
  for (const k of SHIELD_KEYS) {
    if (!instant && cardVisible(k) && (steps[k] || []).length && !shownAt.current[k]) {
      shownAt.current[k] = performance.now()
    }
  }
  const showcaseDone = (k) => {
    if (instant) return true
    const r = results[k]
    if (r?.skipped || r?.consent_declined) return true
    return !!shownAt.current[k] && performance.now() - shownAt.current[k] >= MIN_WORKING_MS
  }
  const resultShown = (k) => !!results[k] && shownCount(k) >= (steps[k] || []).length
    && cardVisible(k) && showcaseDone(k)
  const allRevealed = SHIELD_KEYS.every(resultShown)
  const showAdj = !!adjudication && allRevealed
  const sentinelLines = (steps.sentinel || []).slice(0, sentinelShown)
  const sentinelDone = allRevealed && sentinelShown >= (steps.sentinel || []).length

  const orderedShields = (shieldOrder.length
    ? shieldOrder.filter((k) => SHIELD_KEYS.includes(k))
    : SHIELD_KEYS.filter((k) => results[k] || (steps[k] || []).length)
  ).filter(cardVisible)

  return (
    <div className="risk-panel">
      <p className="rp-sub">Our security shields are reviewing this transfer in real time.</p>

      <div className={`agent-card sentinel-card${sentinelDone ? ' settled' : ''}`}>
        <div className="ac-top">
          <span className="sent-head">
            <span className={`sent-ring${sentinelDone ? ' still' : ''}`} aria-hidden="true">
              <span /><span /><i />
            </span>
            <span>
              <span className="ac-name">
                {SHIELDS.sentinel.label}
                {devMode && sentinelModel && <span className="ac-model">{sentinelModel}</span>}
              </span>
              <span className="ac-desc">{SHIELDS.sentinel.tagline}</span>
            </span>
          </span>
          <span className="ondevice-pill">ON THIS DEVICE</span>
        </div>
        {sentinelLines.length > 0 && (
          <ul className="ac-steps sent-steps">
            {sentinelLines.map((text, i) => (
              <li key={i} className={`sk-think${!sentinelDone && i === sentinelLines.length - 1 ? ' latest' : ''}`}>
                {text}
              </li>
            ))}
          </ul>
        )}
        {sentinelLines.length === 0 && <div className="shimmer" />}
        <p className="sent-note">Reasoning locally — your data never leaves this phone.</p>
      </div>

      {orderedShields.map((key, idx) => {
        const r = results[key]
        if (r?.skipped) {
          // Cascade skip rows one beat apart — the wave-off reads as a
          // sequence of decisions, not a dump.
          const skipRank = orderedShields.slice(0, idx).filter((k) => results[k]?.skipped).length
          return (
            <div
              key={key}
              className="agent-card skipped"
              style={instant ? undefined : { animationDelay: `${skipRank * 0.35}s`, animationFillMode: 'backwards' }}
            >
              <div className="ac-top">
                <span className="ac-head">
                  <ShieldChip shield={key} dim />
                  <span>
                    <span className="ac-name">{SHIELDS[key].label}</span>
                    <span className="ac-desc">{SHIELDS[key].tagline}</span>
                  </span>
                </span>
                <span className="skip-pill">SKIPPED</span>
              </div>
              <p className="ac-rationale skip-why">{r.rationale}</p>
            </div>
          )
        }
        const lines = (steps[key] || []).slice(0, shownCount(key))
        const done = resultShown(key)
        const t = timing.current[key]
        const elapsed = t?.start && t?.end ? ((t.end - t.start) / 1000).toFixed(1) : null
        return (
          <div key={key} className={`agent-card spawn shield-${key}${done ? ' done' : ' working'}`}>
            <div className="ac-top">
              <span className="ac-head">
                <ShieldChip shield={key} />
                <span>
                  <span className="ac-name">
                    {SHIELDS[key].label}
                    {devMode && done && r.model && <span className="ac-model">{r.model}</span>}
                    {devMode && done && r.escalated && <span className="ac-flag">ESCALATED</span>}
                  </span>
                  <span className="ac-desc">{SHIELDS[key].tagline}</span>
                  {invocations[key] && <span className="ac-invoked">↳ {invocations[key]}</span>}
                </span>
              </span>
              {done
                ? (
                  <span className={`score-pill ${band(r)}`}>
                    {r.consent_declined ? '—' : <CountUp value={r.score} instant={instant} />}
                  </span>
                )
                : <span className="ac-analyzing">{lines.length ? 'Working…' : 'Spinning up…'}</span>}
            </div>
            {lines.length > 0 && (
              <ul className="ac-steps">
                {lines.map((text, i) => (
                  <li
                    key={i}
                    className={`sk-${stepKind(text)}${!done && i === lines.length - 1 ? ' latest' : ''}`}
                  >
                    {text}
                  </li>
                ))}
              </ul>
            )}
            {!done && lines.length > 0 && !instant && (() => {
              const Instrument = INSTRUMENTS[key]
              return Instrument ? <Instrument /> : null
            })()}
            {done
              ? (
                <p className="ac-rationale">
                  <TypeText text={r.rationale} instant={instant} />
                  <span className="ac-conf"> · {r.confidence} confidence</span>
                  {devMode && elapsed && <span className="ac-time"> · {elapsed}s</span>}
                </p>
              )
              : lines.length === 0 && <div className="shimmer" />}
          </div>
        )
      })}

      {allRevealed && !showAdj && (
        <div className="adj-pending">
          <span className="adj-pending-dot" />
          {holdReason === 'consent'
            ? 'Adjudicator holding — waiting for your choice'
            : 'Adjudicator weighing the signals…'}
        </div>
      )}
      {showAdj && (
        <div className={`adj-strip ${adjudication.decision}`}>
          <div className="adj-top">
            <strong>
              {adjudication.step_up_method === 'temporary_biometric_permission'
                ? 'One more option to complete this'
                : DECISION_LABEL[adjudication.decision]}
            </strong>
            <span className="adj-score">risk {adjudication.risk_score}</span>
          </div>
          <RiskMeter value={adjudication.risk_score} instant={instant} />
          <p>{adjudication.reasoning}</p>
          {devMode && adjudication.model && (
            <p className="adj-model">adjudicator · {adjudication.model}</p>
          )}
        </div>
      )}
      {showAdj && onProceed && (
        <button className="btn-continue rp-proceed" onClick={onProceed}>
          {PROCEED_LABEL[adjudication.decision]}
        </button>
      )}
      <p className="rp-brand">Protected by NeuroSecure</p>
    </div>
  )
}
