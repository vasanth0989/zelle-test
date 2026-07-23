import { useEffect, useRef, useState } from 'react'
import SHIELDS from './shields.json'

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

// Geo: navy radar screen with a bright sweep + waypoints checked in turn.
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

// Presence: the cursor gliding along its captured path + keystroke cadence.
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

// Transaction: a lens sweeping the payment ledger.
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
export function ShieldChip({ shield, dim = false, big = false }) {
  const ink = '#ffffff'
  const s = big ? 1.55 : 1
  return (
    <span className={`shield-chip chip-${shield}${dim ? ' dim' : ''}${big ? ' big' : ''}`} aria-hidden="true">
      {shield === 'biometric' && (
        <svg viewBox="0 0 24 24" width={16 * s} height={16 * s} fill={ink}><path d={HEART_PATH} /></svg>
      )}
      {shield === 'context' && (
        <svg viewBox="0 0 24 24" width={17 * s} height={17 * s} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill={ink} stroke="none" />
        </svg>
      )}
      {shield === 'behavior' && (
        <svg viewBox="0 0 24 24" width={16 * s} height={16 * s} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9.5" cy="8" r="3.4" />
          <path d="M3.8 20c0-3.1 2.6-5.2 5.7-5.2 1.1 0 2.2.3 3 .8" />
          <path d="M15 17l2.2 2.2L21.5 15" />
        </svg>
      )}
      {shield === 'transaction' && (
        <svg viewBox="0 0 24 24" width={15 * s} height={15 * s} fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )}
    </span>
  )
}

function OneShieldMark({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2l8 3.2v6.2c0 5-3.4 8.7-8 10.6-4.6-1.9-8-5.6-8-10.6V5.2L12 2z" fill="#c02f2f" />
      <path d="M12 5.2l5 2v4.4c0 3.3-2.1 5.9-5 7.3-2.9-1.4-5-4-5-7.3V7.2l5-2z" fill="#fff" opacity="0.92" />
      <path d="M12 8l2.6 1v2.4c0 1.8-1.1 3.2-2.6 4-1.5-.8-2.6-2.2-2.6-4V9l2.6-1z" fill="#c02f2f" />
    </svg>
  )
}

// ---- Keynote focus flow (post Jul 22 feedback) ----
// One shield in focus at a time: big icon, a few icon-toned one-liners, ONE
// insight pill, the on-device star for the free shields. Finished shields
// collapse to compact verdict rows. One Shield narrates a single line at a
// time. Minimal words everywhere — the voiceover carries the rest.

const SHIELD_KEYS = ['transaction', 'context', 'biometric', 'behavior']
const PACED_KEYS = ['sentinel', ...SHIELD_KEYS]
const ON_DEVICE = new Set(['biometric', 'behavior'])

const DECISION = {
  allow: { label: 'Payment approved', klass: 'allow', icon: '✓' },
  step_up: { label: 'Let’s verify a few things', klass: 'step_up', icon: '!' },
  pause: { label: 'Paused for your protection', klass: 'pause', icon: '⏸' },
}

// Presenter pacing controls (set from the scenario rail's ⚙ popover).
// Module-level so the choice survives between runs — in-memory only, no
// storage. The pacing loop reads this live; changes apply mid-run.
export const PACING = { lineMs: 1200, dwellMs: 5000 }

const PROCEED_LABEL = {
  allow: 'Continue',
  step_up: 'Continue to verification',
  pause: 'See details',
}

function band(result) {
  if (result.consent_declined || result.skipped) return 'declined'
  return result.score >= 70 ? 'high' : result.score >= 40 ? 'mid' : 'low'
}

function lineTone(line) {
  if (line.tone) return line.tone
  const t = line.text || ''
  if (t.startsWith('Tool call:')) return 'note'
  return 'note'
}

export default function RiskPanel({
  results, steps, adjudication, invocations = {}, shieldOrder = [], appearAfter = {},
  sentinelModel = null, instant = false, devMode = false, holdReason = null, onProceed,
}) {
  const [visible, setVisible] = useState({})
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const shownAt = useRef({})
  const focusRef = useRef(null)
  const [, setTick] = useState(0)
  const [expanded, setExpanded] = useState({})
  const scrollRef = useRef(null)
  const focusElRef = useRef(null)

  useEffect(() => {
    if (instant) return
    const id = setInterval(() => setTick((t) => t + 1), 300)
    return () => clearInterval(id)
  }, [instant])

  const shownRef = useRef({})
  useEffect(() => {
    if (instant) return
    // Reveal pacing: only One Shield's narration and the FOCUSED shield
    // advance — everything else waits its turn. Bookkeeping stays outside the
    // setState updater (StrictMode double-invokes updaters).
    const last = {}
    const id = setInterval(() => {
      const cur = stepsRef.current
      const now = performance.now()
      const active = new Set(['sentinel', focusRef.current].filter(Boolean))
      let changed = false
      const next = { ...shownRef.current }
      for (const k of PACED_KEYS) {
        if (!active.has(k)) continue
        const total = (cur[k] || []).length
        const shown = next[k] || 0
        const cadence = k === 'sentinel' ? PACING.lineMs * 1.15 : PACING.lineMs
        if (shown >= total) continue
        // Catch-up aware: if the browser throttled our timer (hidden tab),
        // advance as many lines as the elapsed time has earned.
        const elapsed = last[k] ? now - last[k] : cadence
        const earned = Math.min(total - shown, Math.floor(elapsed / cadence))
        if (earned > 0) {
          next[k] = shown + earned
          last[k] = now
          changed = true
        }
      }
      if (changed) {
        shownRef.current = next
        setVisible(next)
      }
    }, 120)
    return () => clearInterval(id)
  }, [instant])

  const shownCount = (k) => (instant ? (steps[k] || []).length : Math.min(visible[k] || 0, (steps[k] || []).length))
  const sentinelShown = shownCount('sentinel')
  const cardVisible = (k) => instant || (appearAfter[k] ?? 0) <= sentinelShown

  const orderedShields = (shieldOrder.length
    ? shieldOrder.filter((k) => SHIELD_KEYS.includes(k))
    : SHIELD_KEYS.filter((k) => results[k] || (steps[k] || []).length)
  ).filter(cardVisible)

  for (const k of orderedShields) {
    if (!instant && (steps[k] || []).length && !shownAt.current[k]) {
      shownAt.current[k] = performance.now()
    }
  }
  const showcaseDone = (k) => {
    if (instant) return true
    const r = results[k]
    if (r?.skipped || r?.consent_declined) return true
    return !!shownAt.current[k] && performance.now() - shownAt.current[k] >= PACING.dwellMs
  }
  const resultShown = (k) => !!results[k] && shownCount(k) >= (steps[k] || []).length
    && cardVisible(k) && showcaseDone(k)

  const doneShields = orderedShields.filter(resultShown)
  const focus = orderedShields.find((k) => !resultShown(k)) || null
  focusRef.current = focus
  const allRevealed = SHIELD_KEYS.every((k) => resultShown(k))
  const showAdj = !!adjudication && allRevealed

  // Auto-follow: keep the active shield (and finally the verdict) in view as
  // the sheet grows — the presenter never has to scroll mid-run.
  useEffect(() => {
    if (instant) return
    focusElRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focus, instant])
  useEffect(() => {
    if (showAdj && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [showAdj])

  const sentinelLines = (steps.sentinel || []).slice(0, sentinelShown)
  const osLine = sentinelLines.length ? sentinelLines[sentinelLines.length - 1] : null

  const focusLines = focus ? (steps[focus] || []).slice(0, shownCount(focus)) : []
  const FocusInstrument = focus ? INSTRUMENTS[focus] : null

  const flagged = SHIELD_KEYS
    .filter((k) => results[k] && !results[k].skipped && !results[k].consent_declined && results[k].score >= 55)
    .sort((a, b) => results[b].score - results[a].score)
    .slice(0, 3)

  return (
    <div className="risk-panel v3">
      <div className="os-brand">
        <OneShieldMark />
        <span className="os-name">One Shield
          {devMode && sentinelModel && <span className="ac-model">{sentinelModel}</span>}
        </span>
        <span className="ondevice-pill">ON THIS DEVICE</span>
      </div>
      {!showAdj && osLine && (
        <p className="os-line" key={sentinelLines.length}>{osLine.text ?? osLine}</p>
      )}

      <div className="rp-scroll" ref={scrollRef}>
      {doneShields.map((key) => {
        const r = results[key]
        const isOpen = !!expanded[key]
        const detailLines = (steps[key] || [])
        if (r.skipped) {
          return (
            <div key={key} className="done-row skipped">
              <ShieldChip shield={key} dim />
              <span className="dr-main">
                <span className="dr-name">{SHIELDS[key].label}</span>
                <span className="dr-verdict">{r.rationale}</span>
              </span>
              <span className="skip-pill">SKIPPED</span>
            </div>
          )
        }
        return (
          <div
            key={key}
            className={`done-row clickable${isOpen ? ' open' : ''}`}
            onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
          >
            <div className="dr-top">
              <ShieldChip shield={key} />
              <span className="dr-main">
                <span className="dr-name">{SHIELDS[key].label}
                  {devMode && r.model && <span className="ac-model">{r.model}</span>}
                </span>
                <span className="dr-verdict">{r.rationale}</span>
              </span>
              <span className={`score-pill ${band(r)}`}>{r.consent_declined ? '—' : r.score}</span>
              <span className={`dr-chev${isOpen ? ' up' : ''}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
            {isOpen && (
              <div className="dr-detail">
                <ul className="fc-lines">
                  {detailLines.filter((l) => !l.insight).map((line, i) => (
                    <li key={i} className={`fl-${lineTone(line)}`}>{line.text ?? line}</li>
                  ))}
                </ul>
                {detailLines.filter((l) => l.insight).map((line, i) => (
                  <div key={`ins-${i}`} className="fc-insight">{line.text}</div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {!showAdj && focus && (
        <div className={`focus-card shield-${focus}`} ref={focusElRef}>
          <div className="fc-head">
            <ShieldChip shield={focus} big />
            <span className="fc-title">
              <span className="fc-name">{SHIELDS[focus].label}</span>
              <span className="fc-sub">{SHIELDS[focus].tagline}</span>
            </span>
          </div>
          {focusLines.length === 0 && <div className="shimmer" />}
          <ul className="fc-lines">
            {focusLines.filter((l) => !l.insight).map((line, i) => (
              <li key={i} className={`fl-${lineTone(line)}`}>{line.text ?? line}</li>
            ))}
          </ul>
          {focusLines.filter((l) => l.insight).map((line, i) => (
            <div key={`ins-${i}`} className="fc-insight">{line.text}</div>
          ))}
          {FocusInstrument && !instant && <FocusInstrument />}
          {ON_DEVICE.has(focus) && (
            <p className="fc-star">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="11" width="16" height="10" rx="2.5" />
                <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
              </svg>
              <span>Data never leaves this device</span>
            </p>
          )}
        </div>
      )}

      {allRevealed && !showAdj && (
        <div className="adj-pending">
          <span className="adj-pending-dot" />
          {holdReason === 'consent'
            ? 'One Shield is holding — waiting for your choice'
            : 'Weighing every shield…'}
        </div>
      )}

      {showAdj && (() => {
        const d = DECISION[adjudication.decision] || DECISION.step_up
        return (
          <div className={`verdict ${d.klass}`}>
            <span className={`verdict-icon ${d.klass}`}>{d.icon}</span>
            <h3 className="verdict-title">
              {adjudication.step_up_method === 'temporary_biometric_permission'
                ? 'One more option to complete this'
                : d.label}
            </h3>
            <p className="verdict-why">{adjudication.reasoning}</p>
            {flagged.length > 0 && (
              <div className="verdict-chips">
                {flagged.map((k) => (
                  <span key={k} className="v-chip">⚠ {results[k].rationale}</span>
                ))}
              </div>
            )}
            <p className="verdict-sub">Decided on this device — before the money moved.</p>
            {devMode && (
              <p className="adj-model">risk {adjudication.risk_score} · {adjudication.model || 'adjudicator'}</p>
            )}
          </div>
        )
      })()}

      {showAdj && onProceed && (
        <button className="btn-continue rp-proceed" onClick={onProceed}>
          {PROCEED_LABEL[adjudication.decision]}
        </button>
      )}
      </div>

      <div className="rp-dots" aria-hidden="true">
        {SHIELD_KEYS.map((k) => (
          <i key={k} className={resultShown(k) ? 'filled' : k === focus ? 'active' : ''} />
        ))}
      </div>
      <p className="rp-brand">One Shield · Protected on this device</p>
    </div>
  )
}
