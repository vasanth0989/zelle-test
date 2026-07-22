// Standalone mock backend (config.js MOCK_BACKEND = true).
//
// Scripted replays of real runs — same v2.2 wire format the FastAPI backend
// streams (sentinel meta / sentinel steps / invoke / step / result / skipped
// result / consent_request / adjudication), so RiskPanel needs zero changes
// and the real integration can be re-enabled by flipping one flag.
//
// Scenario state syncs across tabs over the existing BroadcastChannel — the
// control panel keeps working with no server.

const MODELS = { default: 'llama-3.3-70b', biometric: 'gemma-4-26b' }

// ---------- event constructors ----------
const sstep = (text) => ({ type: 'step', shield: 'sentinel', text })
const step = (shield, text) => ({ type: 'step', shield, text })
const inv = (shield, reason) => ({ type: 'invoke', shield, reason })
const res = (shield, score, confidence, rationale, steps, extra = {}) => ({
  type: 'result', shield, score, confidence, rationale, steps,
  model: shield === 'biometric' ? MODELS.biometric : MODELS.default,
  escalated: true, ...extra,
})
const skip = (shield, note) => ({
  type: 'result', shield, score: 50, confidence: 'low', rationale: note,
  steps: ['Sentinel decision → skipped'], skipped: true,
})
const adj = (decision, risk, method, message, reasoning) => ({
  type: 'adjudication', decision, risk_score: risk, step_up_method: method,
  customer_message: message, reasoning, model: MODELS.default,
})
const META = { type: 'sentinel', model: MODELS.default }

// ---------- scenario tapes: [delayMs, event] pairs, played in order ----------

const NORMAL_TAPE = [
  [200, META],
  [700, sstep('$60 sits well inside the typical $50–$200 range.')],
  [900, sstep('Known payee, nothing flagged — the free on-device checks are enough.')],
  [500, inv('transaction', 'Known payee, nothing flagged — the free on-device checks are enough.')],
  [150, inv('behavior', 'Known payee, nothing flagged — the free on-device checks are enough.')],
  [500, step('transaction', 'Loaded transaction slice')],
  [300, step('behavior', 'Loaded behavior slice')],
  [700, step('transaction', 'Payee Ravi appears throughout the recent history.')],
  [400, step('behavior', 'mouse_path_linearity is within the customer’s baseline range')],
  [700, step('transaction', 'Amount $60 falls within the typical range of $50–$200.')],
  [400, step('behavior', 'typing_cadence_var_ms matches typical human variance')],
  [600, step('behavior', 'hesitation_before_send_ms shows natural deliberation')],
  [1000, res('transaction', 25, 'medium',
    'Routine payment to a familiar payee, comfortably within the usual range.',
    ['Loaded transaction slice', 'Payee Ravi appears throughout the recent history.',
      'Amount $60 falls within the typical range of $50–$200.'], { escalated: false })],
  [700, res('behavior', 15, 'high',
    'The interaction shows natural human patterns across every telemetry signal.',
    ['Loaded behavior slice', 'mouse_path_linearity is within the customer’s baseline range',
      'typing_cadence_var_ms matches typical human variance',
      'hesitation_before_send_ms shows natural deliberation'], { escalated: false })],
  [1100, sstep('Transaction 25, behavior 15 — clean and in-pattern.')],
  [900, sstep('No reason to dig deeper — concluding the investigation.')],
  [700, skip('context', 'Routine in-pattern payment — the location check wasn’t needed.')],
  [500, skip('biometric', 'Both free checks were clean; no cause to read the customer’s vitals.')],
  [2200, adj('allow', 22, null, '',
    'All informative signals are low and consistent with this customer’s normal pattern.')],
]

const COERCED_TAPE = [
  [200, META],
  [700, sstep('$450 is above the typical $50–$200 range — I need to know where they are.')],
  [1000, sstep('This payee has never been seen before. Establishing context first.')],
  [500, inv('context', 'This payee has never been seen before. Establishing context first.')],
  [150, inv('transaction', 'This payee has never been seen before. Establishing context first.')],
  [600, step('context', 'Escalated payment — staged evaluation')],
  [300, step('transaction', 'Escalated payment — staged evaluation')],
  [900, step('context', 'Initial read (80/100): Major rail hub at midnight is unusual for a customer who typically pays from home or office.')],
  [500, step('transaction', 'Initial read (65/100): Payee is new and the amount exceeds the typical range.')],
  [800, step('context', 'Tool call: location service (mock) → home distance, location history')],
  [500, step('transaction', 'Tool call: ledger service (mock) → 24h velocity, balance share')],
  [900, step('context', 'Transit stations are not typical locations for this customer.')],
  [500, step('transaction', 'Compared $450 against the typical range of $50–$200.')],
  [800, step('context', 'The local time of 01:04 falls within the customer’s sleep window (23:00–06:30).')],
  [500, step('transaction', 'Confirmed this is the first payment ever to this payee.')],
  [800, step('context', 'First transaction ever at this hour, 6.2 km from home.')],
  [1100, res('context', 85, 'high',
    'The customer is making a payment at a major rail hub at 1 AM, inside their typical sleep window.',
    ['Escalated payment — staged evaluation',
      'Initial read (80/100): Major rail hub at midnight is unusual for a customer who typically pays from home or office.',
      'Tool call: location service (mock) → home distance, location history',
      'Transit stations are not typical locations for this customer.',
      'The local time of 01:04 falls within the customer’s sleep window (23:00–06:30).',
      'First transaction ever at this hour, 6.2 km from home.'])],
  [700, res('transaction', 75, 'medium',
    'This payment is well above the customer’s typical range and goes to a first-seen payee.',
    ['Escalated payment — staged evaluation',
      'Initial read (65/100): Payee is new and the amount exceeds the typical range.',
      'Tool call: ledger service (mock) → 24h velocity, balance share',
      'Compared $450 against the typical range of $50–$200.',
      'Confirmed this is the first payment ever to this payee.'])],
  [1200, sstep('Context came back 85 — a rail hub at 1 AM. Now I need the human’s vitals.')],
  [1000, sstep('Behavior will tell me who is really driving this session.')],
  [500, inv('biometric', 'Behavior will tell me who is really driving this session.')],
  [150, inv('behavior', 'Behavior will tell me who is really driving this session.')],
  [600, step('biometric', 'Consent check → granted')],
  [300, step('behavior', 'Escalated payment — staged evaluation')],
  [700, step('biometric', 'Escalated payment — staged evaluation')],
  [500, step('behavior', 'Initial read (30/100): Input cadence looks human; confirming with the full session.')],
  [800, step('biometric', 'Initial read (65/100): Heart rate significantly elevated above baseline (118 vs 62).')],
  [500, step('behavior', 'Tool call: session recorder (mock) → typing cadence, hesitation, field fill')],
  [800, step('biometric', 'Tool call: HealthKit (mock) → respiration, skin temp, activity state')],
  [600, step('behavior', 'Mouse movement and typing rhythm are consistent with one present human.')],
  [800, step('biometric', 'Heart rate 118 vs resting 62 — significantly elevated')],
  [700, step('biometric', 'Respiration 22 — elevated; skin temperature up 0.8°C')],
  [700, step('biometric', 'Activity state stationary — exertion ruled out')],
  [900, res('behavior', 15, 'high',
    'A real human is present and driving this session — no signs of automation or remote control.',
    ['Escalated payment — staged evaluation',
      'Initial read (30/100): Input cadence looks human; confirming with the full session.',
      'Tool call: session recorder (mock) → typing cadence, hesitation, field fill',
      'Mouse movement and typing rhythm are consistent with one present human.'])],
  [800, res('biometric', 82, 'high',
    'Elevated heart rate and respiration while stationary, during the customer’s sleep window — consistent with acute stress.',
    ['Consent check → granted', 'Escalated payment — staged evaluation',
      'Initial read (65/100): Heart rate significantly elevated above baseline (118 vs 62).',
      'Tool call: HealthKit (mock) → respiration, skin temp, activity state',
      'Heart rate 118 vs resting 62 — significantly elevated',
      'Respiration 22 — elevated; skin temperature up 0.8°C',
      'Activity state stationary — exertion ruled out'])],
  [2600, adj('step_up', 85, 'questions',
    'Before this payment goes through, we need to check a couple of things with you.',
    'Independent signals converge on coercion: acute stress at an unusual place and hour, while a real human is present — an OTP could not catch this.')],
]

const BOT_TAPE = [
  [200, META],
  [700, sstep('$5,200 is 26× this customer’s typical range — establishing context first.')],
  [1000, sstep('First-seen payee on an irreversible rail. I need the full picture.')],
  [500, inv('context', 'First-seen payee on an irreversible rail. I need the full picture.')],
  [150, inv('transaction', 'First-seen payee on an irreversible rail. I need the full picture.')],
  [600, step('context', 'Escalated payment — staged evaluation')],
  [300, step('transaction', 'Escalated payment — staged evaluation')],
  [800, step('context', 'Initial read (15/100): Home, mid-afternoon — nothing unusual about the setting.')],
  [500, step('transaction', 'Initial read (80/100): Amount is far outside the typical range for a new payee.')],
  [800, step('context', 'Location and hour match the customer’s normal pattern.')],
  [500, step('transaction', 'Tool call: ledger service (mock) → 24h velocity, balance share')],
  [700, step('transaction', 'This single payment would move most of the available balance.')],
  [1000, res('context', 5, 'high',
    'The customer is at home during normal hours — the setting raises no concern.',
    ['Escalated payment — staged evaluation',
      'Initial read (15/100): Home, mid-afternoon — nothing unusual about the setting.',
      'Location and hour match the customer’s normal pattern.'])],
  [700, res('transaction', 85, 'high',
    'An extreme outlier: 26× the typical amount, first-seen payee, most of the balance in one transfer.',
    ['Escalated payment — staged evaluation',
      'Initial read (80/100): Amount is far outside the typical range for a new payee.',
      'Tool call: ledger service (mock) → 24h velocity, balance share',
      'This single payment would move most of the available balance.'])],
  [1200, sstep('Transaction is anomalous at 85. I need vitals and the session’s driver.')],
  [500, inv('biometric', 'Transaction is anomalous at 85. I need vitals and the session’s driver.')],
  [150, inv('behavior', 'Transaction is anomalous at 85. I need vitals and the session’s driver.')],
  [600, step('behavior', 'Escalated payment — staged evaluation')],
  [300, step('biometric', 'Consent check → granted')],
  [700, step('behavior', 'Initial read (95/100): Machine-timed keystrokes and perfectly straight mouse movement.')],
  [500, step('biometric', 'Heart rate 71 vs resting 62 — calm')],
  [800, step('behavior', 'Tool call: session recorder (mock) → typing cadence, hesitation, field fill')],
  [600, step('behavior', 'mouse_path_linearity of 0.97 indicates scripted movement')],
  [700, step('behavior', 'Recipient and amount were pasted in 180 ms — no human hesitation')],
  [900, res('biometric', 10, 'high',
    'Vitals are calm and unremarkable — whoever is present is not stressed.',
    ['Consent check → granted', 'Heart rate 71 vs resting 62 — calm'])],
  [800, res('behavior', 92, 'high',
    'The session shows machine cadence throughout — this is automation or remote control, not the customer’s hand.',
    ['Escalated payment — staged evaluation',
      'Initial read (95/100): Machine-timed keystrokes and perfectly straight mouse movement.',
      'Tool call: session recorder (mock) → typing cadence, hesitation, field fill',
      'mouse_path_linearity of 0.97 indicates scripted movement',
      'Recipient and amount were pasted in 180 ms — no human hesitation'])],
  [2600, adj('pause', 95, null,
    'This payment is paused for your protection. No money has left your account — we’ll help you review it.',
    'Machine-cadence input converging with an extreme transaction outlier is the automation pattern; pausing outranks challenging a bot.')],
]

const WORKOUT_TAPE = [
  [200, META],
  [700, sstep('A wearable alert arrived moments ago — heart rate 121 vs resting 62.')],
  [1000, sstep('That needs explaining before any money moves. Reading vitals and surroundings together.')],
  [500, inv('biometric', 'That needs explaining before any money moves. Reading vitals and surroundings together.')],
  [150, inv('context', 'That needs explaining before any money moves. Reading vitals and surroundings together.')],
  [600, step('biometric', 'Consent check → granted')],
  [300, step('context', 'Loaded context slice')],
  [700, step('biometric', 'Tool call: HealthKit (mock) → respiration, skin temp, activity state')],
  [500, step('context', 'Place type is a fitness center, 2.1 km from home, at 18:40.')],
  [800, step('biometric', 'Heart rate 121 vs resting 62 — strongly elevated')],
  [600, step('context', 'Evening gym visits fit the customer’s regular routine.')],
  [800, step('biometric', 'Activity state: workout_in_progress — exertion explains the elevation')],
  [700, step('biometric', 'Respiration and skin temperature match active exercise, not stress')],
  [1000, res('context', 20, 'high',
    'A familiar gym at a normal hour — the setting is entirely routine for this customer.',
    ['Loaded context slice', 'Place type is a fitness center, 2.1 km from home, at 18:40.',
      'Evening gym visits fit the customer’s regular routine.'])],
  [800, res('biometric', 15, 'high',
    'The elevated readings are fully explained by an active workout — this is exertion, not stress.',
    ['Consent check → granted',
      'Tool call: HealthKit (mock) → respiration, skin temp, activity state',
      'Heart rate 121 vs resting 62 — strongly elevated',
      'Activity state: workout_in_progress — exertion explains the elevation',
      'Respiration and skin temperature match active exercise, not stress'])],
  [1200, sstep('Heart rate 121 — the same number that flags coercion — explained by a workout.')],
  [1000, sstep('Context, not thresholds. Nothing else to check — concluding.')],
  [700, skip('transaction', 'The vitals alert is explained and the payment fits the customer’s pattern.')],
  [500, skip('behavior', 'No anomaly left to corroborate — the session needed no inspection.')],
  [2200, adj('allow', 28, null, '',
    'The wearable alert is fully explained by activity; no independent risk signals remain.')],
]

const NO_CONSENT_TAPE = [
  [200, META],
  [600, step('biometric', 'Consent check → declined')],
  [400, res('biometric', 50, 'low',
    'Biometric signals unavailable — customer has not granted permission.',
    ['Consent check → declined'], { consent_declined: true, escalated: false })],
  [800, sstep('Biometric consent not granted — asking for a one-time reading.')],
  [500, { type: 'consent_request', method: 'temporary_biometric_permission',
    message: 'We’d like to complete this transfer with one extra safeguard. If you allow a one-time wellness reading from your connected wearable, we can confirm everything looks normal and send your payment now. Nothing is stored — we analyze, never keep.' }],
  [900, sstep('$950 to a first-seen payee — well above the typical range.')],
  [1000, sstep('Establishing where the customer is and how far off pattern this sits.')],
  [500, inv('context', 'Establishing where the customer is and how far off pattern this sits.')],
  [150, inv('transaction', 'Establishing where the customer is and how far off pattern this sits.')],
  [600, step('context', 'Escalated payment — staged evaluation')],
  [300, step('transaction', 'Escalated payment — staged evaluation')],
  [800, step('context', 'A shopping district at 20:45 — plausible, though 14 km from home.')],
  [500, step('transaction', 'Initial read (70/100): $950 is well above the typical range, payee never seen.')],
  [800, step('transaction', 'Tool call: ledger service (mock) → 24h velocity, balance share')],
  [900, res('context', 35, 'medium',
    'An evening shopping district visit is plausible but farther from home than usual.',
    ['Escalated payment — staged evaluation',
      'A shopping district at 20:45 — plausible, though 14 km from home.'])],
  [700, res('transaction', 75, 'medium',
    'Well above the typical range to a first-seen payee — a genuine outlier for this customer.',
    ['Escalated payment — staged evaluation',
      'Initial read (70/100): $950 is well above the typical range, payee never seen.',
      'Tool call: ledger service (mock) → 24h velocity, balance share'])],
  [1200, sstep('Transaction is high at 75 — checking who is driving the session.')],
  [500, inv('behavior', 'Transaction is high at 75 — checking who is driving the session.')],
  [600, step('behavior', 'Loaded behavior slice')],
  [700, step('behavior', 'Typing rhythm and cursor movement look naturally human.')],
  [900, res('behavior', 15, 'high',
    'A present human is driving this session — no automation markers.',
    ['Loaded behavior slice', 'Typing rhythm and cursor movement look naturally human.'], { escalated: false })],
  { consentWait: {
    granted: [
      [800, step('biometric', 'Temporary permission granted — one-time read')],
      [700, step('biometric', 'Tool call: HealthKit (mock) → respiration, skin temp, activity state')],
      [800, step('biometric', 'Heart rate 74 vs resting 62 — mild elevation only')],
      [700, step('biometric', 'Respiration 15 — normal range; no stress markers')],
      [1000, res('biometric', 12, 'high',
        'The one-time reading came back calm — vitals are consistent with ordinary evening shopping.',
        ['Temporary permission granted — one-time read',
          'Tool call: HealthKit (mock) → respiration, skin temp, activity state',
          'Heart rate 74 vs resting 62 — mild elevation only',
          'Respiration 15 — normal range; no stress markers'])],
      [2400, adj('allow', 35, null, '',
        'The granted wellness read resolved the ambiguity: with calm biometrics, the remaining signals do not converge on risk.')],
    ],
    declined: [
      [2000, adj('step_up', 60, 'questions',
        'We just need to verify a couple of things before this payment goes through.',
        'Without biometrics, the elevated transaction signal is best resolved with a quick check-in — declining the reading is never held against the customer.')],
    ],
  } },
]

// Continuations reachable from any scenario
const CHALLENGE_TAPE = [
  [1200, adj('allow', 15, null, '',
    'The customer answered the verification questions consistently; the payment proceeds.')],
]
const OFFER_DECLINED_TAPE = [
  [1800, adj('step_up', 60, 'questions',
    'We just need to verify a couple of things before this payment goes through.',
    'Resolved from the three available signals — the declined offer is not evidence of risk.')],
]

const TAPES = {
  normal: NORMAL_TAPE,
  coerced: COERCED_TAPE,
  bot: BOT_TAPE,
  workout: WORKOUT_TAPE,
  no_consent: NO_CONSENT_TAPE,
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
// CATCH UP in a burst if the browser throttled timers (backgrounded tab) —
// a chained setTimeout would crawl one event per second there. SPEED scales
// every scripted delay; the UI's own reveal pacing supplies readability.
const SPEED = 0.6
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
    // Grant-screen re-run: the investigation replays with the one-time read
    // instead of the declined placeholder and consent ask.
    const base = NO_CONSENT_TAPE.filter((item) => Array.isArray(item))
      .filter(([, evt]) => evt.type !== 'consent_request'
        && !(evt.type === 'result' && evt.consent_declined)
        && !(evt.type === 'step' && evt.text === 'Consent check → declined')
        && !(evt.type === 'step' && evt.shield === 'sentinel' && evt.text.startsWith('Biometric consent not granted')))
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
