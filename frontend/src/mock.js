// Standalone mock backend (config.js MOCK_BACKEND = true).
//
// Keynote-style tapes (post Jul 22 feedback): minimal words, icon-toned
// one-liners, ONE insight pill per shield, short verdicts. Routing per
// Shantanu's rules — Biometric + Presence are free on-device checks and ALWAYS
// run first; Geo/Transaction follow; Geo is what gets skipped on low risk.
//
// Wire format matches the real backend (sentinel meta / step / invoke /
// result / consent_request / adjudication) plus mock-only step fields:
//   tone: 'ok' | 'alert' | 'note'   → ✓ / ⚠ / › line styling
//   insight: true                   → renders as the highlighted pill
// Scenario state syncs across tabs over BroadcastChannel — no server needed.

const MODELS = { default: 'llama-3.3-70b', biometric: 'gemma-4-26b' }

// ---------- event constructors ----------
const os = (text) => ({ type: 'step', shield: 'sentinel', text })
const ok = (shield, text) => ({ type: 'step', shield, text, tone: 'ok' })
const alert = (shield, text) => ({ type: 'step', shield, text, tone: 'alert' })
const note = (shield, text) => ({ type: 'step', shield, text, tone: 'note' })
const insight = (shield, text) => ({ type: 'step', shield, text, insight: true })
const inv = (shield, reason) => ({ type: 'invoke', shield, reason })
const res = (shield, score, rationale, extra = {}) => ({
  type: 'result', shield, score, confidence: 'high', rationale, steps: [],
  model: shield === 'biometric' ? MODELS.biometric : MODELS.default, ...extra,
})
const skip = (shield, noteText) => ({
  type: 'result', shield, score: 50, confidence: 'low', rationale: noteText,
  steps: [], skipped: true,
})
const adj = (decision, risk, method, message, reasoning) => ({
  type: 'adjudication', decision, risk_score: risk, step_up_method: method,
  customer_message: message, reasoning, model: MODELS.default,
})
const META = { type: 'sentinel', model: MODELS.default }

// ---------- scenario tapes: [delayMs, event] pairs ----------

const NORMAL_TAPE = [
  [200, META],
  [600, os('Free on-device checks first — vitals and presence.')],
  [400, inv('biometric', 'free on-device check')],
  [150, inv('behavior', 'free on-device check')],
  [700, note('biometric', 'Reading wearable vitals')],
  [900, ok('biometric', 'Heart rate normal')],
  [800, ok('biometric', 'No stress signals')],
  [700, insight('biometric', 'Calm — matches your everyday baseline')],
  [900, res('biometric', 10, 'Calm and unremarkable')],
  [600, note('behavior', 'Watching typing and touch')],
  [900, ok('behavior', 'Natural typing rhythm')],
  [800, ok('behavior', 'Familiar hand on the device')],
  [700, insight('behavior', 'This is the account holder')],
  [900, res('behavior', 15, 'The real account holder')],
  [800, os('Both clear. One quick look at the payment.')],
  [400, inv('transaction', 'quick pattern check')],
  [800, ok('transaction', '$60 — inside your range')],
  [800, ok('transaction', 'Payee you use monthly')],
  [700, insight('transaction', 'Fits your financial fingerprint')],
  [900, res('transaction', 20, 'Fits your pattern')],
  [800, os('Low risk everywhere — Geo not needed.')],
  [500, skip('context', 'Skipped — everything else was clear')],
  [1600, adj('allow', 15, null, '',
    'Every signal matches you. Decided before the money moved.')],
]

const GRANDPARENT_TAPE = [
  [200, META],
  [600, os('Free on-device checks first — vitals and presence.')],
  [400, inv('biometric', 'free on-device check')],
  [150, inv('behavior', 'free on-device check')],
  [700, note('biometric', 'Reading wearable vitals')],
  [900, alert('biometric', 'Heart racing — 118 vs 62')],
  [800, alert('biometric', 'Stress while sitting still')],
  [700, insight('biometric', 'Signs of acute stress detected')],
  [900, res('biometric', 82, 'Acute stress detected')],
  [600, note('behavior', 'Watching typing and touch')],
  [900, ok('behavior', 'A real person is typing')],
  [800, alert('behavior', 'Long pauses — following instructions?')],
  [700, insight('behavior', 'Present, but possibly guided')],
  [900, res('behavior', 45, 'Present, possibly guided')],
  [900, os('Stress with no explanation — checking the payment and the setting.')],
  [400, inv('transaction', 'corroborate the stress signal')],
  [150, inv('context', 'corroborate the stress signal')],
  [800, alert('transaction', '$2,000 — way above your limit')],
  [800, alert('transaction', 'First-time payee')],
  [700, insight('transaction', '10× your usual payment')],
  [900, res('transaction', 78, 'Way above your limit')],
  [700, ok('context', 'At home — location normal')],
  [800, alert('context', '9 PM — during an active phone call')],
  [700, insight('context', 'Classic scam-call setting')],
  [900, res('context', 55, 'Scam-call setting')],
  [1800, adj('step_up', 85, 'questions',
    'Before this goes through — is someone on the phone asking you to make this payment?',
    'Acute stress + a payment far outside your pattern. An OTP would miss this.')],
]

const REMOTE_TAPE = [
  [200, META],
  [600, os('Free on-device checks first — vitals and presence.')],
  [400, inv('biometric', 'free on-device check')],
  [150, inv('behavior', 'free on-device check')],
  [700, note('behavior', 'Watching typing and touch')],
  [900, alert('behavior', 'Machine-speed typing')],
  [800, alert('behavior', 'Cursor moving in straight lines')],
  [800, alert('behavior', 'Fields pasted in 0.2s')],
  [700, insight('behavior', 'This is not the account holder’s hand')],
  [900, res('behavior', 92, 'Not the account holder’s hand')],
  [600, note('biometric', 'Reading wearable vitals')],
  [900, ok('biometric', 'Vitals calm')],
  [700, insight('biometric', 'Whoever is present isn’t doing the typing')],
  [900, res('biometric', 12, 'Calm — but not typing')],
  [900, os('Automation suspected — checking the payment.')],
  [400, inv('transaction', 'corroborate automation')],
  [800, alert('transaction', '$5,200 — way above your limit')],
  [800, alert('transaction', 'Would drain most of the balance')],
  [700, insight('transaction', 'Everything a takeover looks like')],
  [900, res('transaction', 85, 'Way above your limit')],
  [800, os('No need for Geo — the hand on the device isn’t yours.')],
  [500, skip('context', 'Skipped — the session itself is the evidence')],
  [1800, adj('pause', 95, null,
    'Payment paused for your protection. No money has left your account.',
    'A bot is driving this session. Pausing beats challenging a machine.')],
]

const IMPAIRED_TAPE = [
  [200, META],
  [600, os('Free on-device checks first — vitals and presence.')],
  [400, inv('biometric', 'free on-device check')],
  [150, inv('behavior', 'free on-device check')],
  [700, note('biometric', 'Reading wearable vitals')],
  [900, alert('biometric', '2 AM — deep inside your sleep window')],
  [800, alert('biometric', 'Vitals erratic')],
  [700, insight('biometric', 'Impairment pattern, not stress')],
  [900, res('biometric', 65, 'Impairment pattern')],
  [600, note('behavior', 'Watching typing and touch')],
  [900, alert('behavior', 'Erratic typing — many mis-taps')],
  [700, insight('behavior', 'You — but not at your best')],
  [900, res('behavior', 60, 'Unsteady interaction')],
  [900, os('Something is off — checking the payment and the setting.')],
  [400, inv('context', 'corroborate impairment')],
  [150, inv('transaction', 'corroborate impairment')],
  [800, alert('context', '4 miles from home at 2 AM')],
  [700, insight('context', 'Unusual place, unusual hour')],
  [900, res('context', 62, 'Unusual place and hour')],
  [800, alert('transaction', '$500 — first-time payee, round amount')],
  [700, insight('transaction', 'Zelle can’t be undone')],
  [900, res('transaction', 58, 'Irreversible + first-time payee')],
  [1800, adj('step_up', 72, 'questions',
    'This payment is instant and final. Take a moment — would tomorrow work?',
    'Every signal says impaired, not scammed. A pause protects the customer from themselves.')],
]

const WORKOUT_TAPE = [
  [200, META],
  [600, os('Your watch flagged a racing heart — checking before money moves.')],
  [400, inv('biometric', 'wearable alert')],
  [150, inv('behavior', 'free on-device check')],
  [700, note('biometric', 'Reading wearable vitals')],
  [900, alert('biometric', 'Heart rate 121 — double resting')],
  [800, ok('biometric', 'Breathing pattern: exercise, not fear')],
  [700, insight('biometric', 'Explained: workout in progress')],
  [900, res('biometric', 15, 'Explained by exercise')],
  [600, note('behavior', 'Watching typing and touch')],
  [900, ok('behavior', 'Natural rhythm — it’s you')],
  [700, insight('behavior', 'The account holder, mid-workout')],
  [900, res('behavior', 12, 'The real account holder')],
  [800, os('Confirming the setting.')],
  [400, inv('context', 'confirm the workout')],
  [800, ok('context', 'At your gym — routine visit')],
  [700, insight('context', 'Same place, same time as always')],
  [900, res('context', 10, 'Your usual gym')],
  [800, os('Racing heart, fully explained. Payment is yours.')],
  [400, inv('transaction', 'quick pattern check')],
  [800, ok('transaction', '$120 — inside your range')],
  [900, res('transaction', 18, 'Fits your pattern')],
  [1600, adj('allow', 20, null, '',
    'The same heart rate that flags coercion — cleared by context, not thresholds.')],
]

const NO_CONSENT_TAPE = [
  [200, META],
  [600, note('biometric', 'Consent check → declined')],
  [400, res('biometric', 50, 'No permission — never used against you',
    { consent_declined: true, confidence: 'low' })],
  [800, os('No biometric consent — asking for a one-time reading.')],
  [500, { type: 'consent_request', method: 'temporary_biometric_permission',
    message: 'Allow a one-time wellness reading and we can confirm everything looks normal and send your payment now. Nothing is stored — we analyze, never keep.' }],
  [900, os('Meanwhile — the free checks and the payment.')],
  [400, inv('behavior', 'free on-device check')],
  [900, ok('behavior', 'Natural rhythm — it’s you')],
  [900, res('behavior', 15, 'The real account holder')],
  [400, inv('transaction', 'pattern check')],
  [800, alert('transaction', '$950 — above your limit')],
  [800, alert('transaction', 'First-time payee')],
  [900, res('transaction', 75, 'Above your limit')],
  [400, inv('context', 'setting check')],
  [800, ok('context', 'Shopping district — plausible evening')],
  [900, res('context', 35, 'Plausible setting')],
  { consentWait: {
    granted: [
      [800, note('biometric', 'One-time reading — analyzed, never kept')],
      [900, ok('biometric', 'Vitals calm')],
      [700, insight('biometric', 'Everything looks normal')],
      [900, res('biometric', 12, 'Calm — one-time read')],
      [1600, adj('allow', 30, null, '',
        'The one-time reading resolved it. Sharing made it seamless.')],
    ],
    declined: [
      [1500, adj('step_up', 60, 'questions',
        'We just need to verify a couple of things before this payment goes through.',
        'Declining is never held against you — we simply verify another way.')],
    ],
  } },
]

// Continuations reachable from any scenario
const CHALLENGE_TAPE = [
  [1200, adj('allow', 15, null, '',
    'Answers came at a natural pace — the customer is in control.')],
]
const OFFER_DECLINED_TAPE = [
  [1500, adj('step_up', 60, 'questions',
    'We just need to verify a couple of things before this payment goes through.',
    'Declining is never held against you — we simply verify another way.')],
]

const TAPES = {
  normal: NORMAL_TAPE,
  grandparent: GRANDPARENT_TAPE,
  remote: REMOTE_TAPE,
  impaired: IMPAIRED_TAPE,
  workout: WORKOUT_TAPE,
  no_consent: NO_CONSENT_TAPE,
  // Legacy panel names still work
  coerced: GRANDPARENT_TAPE,
  bot: REMOTE_TAPE,
}

// ---------- scenario state, synced across tabs (no storage — channel only) ----------
const state = { scenario: 'normal' }
let channel = null
if (typeof BroadcastChannel !== 'undefined') {
  channel = new BroadcastChannel('neurosecure-ctl')
  channel.onmessage = (e) => {
    if (e.data?.type === 'scenario') state.scenario = e.data.name
    if (e.data?.type === 'request_scenario' && channel) {
      channel.postMessage({ type: 'scenario', name: state.scenario })
    }
  }
  channel.postMessage({ type: 'request_scenario' }) // catch up on load
}

export async function mockGetScenario() {
  return { active: state.scenario }
}

export async function mockSetScenario(name) {
  state.scenario = name
  channel?.postMessage({ type: 'scenario', name })
  return { active: name }
}

// ---------- tape player ----------
// Absolute-clock scheduler: events are emitted against elapsed wall time and
// CATCH UP in a burst if the browser throttled timers. SPEED scales every
// scripted delay; the UI's own reveal pacing supplies readability.
const SPEED = 0.7
const RUNS = {}

function playTape(tape, onEvent, run) {
  const items = []
  let t = 0
  let consentWait = null
  for (const item of tape) {
    if (item.consentWait) { consentWait = item.consentWait; break }
    t += item[0] * SPEED
    items.push({ at: t, event: item[1] })
  }
  const start = performance.now()
  let emitted = 0
  const pump = () => {
    if (run.cancelled) { clearInterval(run.timer); return }
    const elapsed = performance.now() - start
    while (emitted < items.length && items[emitted].at <= elapsed) {
      onEvent(items[emitted++].event)
    }
    if (emitted >= items.length) {
      clearInterval(run.timer)
      if (consentWait) {
        run.onRespond = (grant) => {
          run.onRespond = null
          playTape(grant ? consentWait.granted : consentWait.declined, onEvent, run)
        }
      }
    }
  }
  run.timer = setInterval(pump, 200)
  pump()
}

function tapeFor(payload) {
  if (payload.challenge_passed) return CHALLENGE_TAPE
  const consent = payload.consent || {}
  if (consent.offer_declined) return OFFER_DECLINED_TAPE
  if (consent.temporary) {
    const base = NO_CONSENT_TAPE.filter((item) => Array.isArray(item))
      .filter(([, evt]) => evt.type !== 'consent_request'
        && !(evt.type === 'result' && evt.consent_declined)
        && !(evt.type === 'step' && evt.shield === 'biometric' && evt.text.startsWith('Consent check'))
        && !(evt.type === 'step' && evt.shield === 'sentinel' && evt.text.startsWith('No biometric consent')))
    const granted = NO_CONSENT_TAPE.find((item) => item.consentWait).consentWait.granted
    return [...base, ...granted]
  }
  if (consent.biometrics === false || state.scenario === 'no_consent') return NO_CONSENT_TAPE
  return TAPES[state.scenario] || NORMAL_TAPE
}

export function mockEvaluate(payload, onEvent) {
  const run = { cancelled: false, timer: null, onRespond: null }
  const runId = 'mock-' + Math.random().toString(36).slice(2, 8)
  RUNS[runId] = run
  console.log('[NeuroSecure mock] evaluate →', state.scenario, payload)
  onEvent({ type: 'run_started', run_id: runId })
  playTape(tapeFor(payload), onEvent, run)
  return () => {
    run.cancelled = true
    clearInterval(run.timer)
    delete RUNS[runId]
  }
}

export async function mockRespond(runId, grant) {
  const run = RUNS[runId]
  if (run?.onRespond) run.onRespond(grant)
  return { ok: true }
}
