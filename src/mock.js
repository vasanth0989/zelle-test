// Mocked shield results in the v2 wire format (docs/CONTRACTS.md): interleaved
// {type:"step"} and {type:"result"} events per shield, {type:"adjudication"} last.
// Replaced by the real backend in Phase 4 — until then this module IS the server.
//
// ============================================================================
// EDIT ME to demo a different outcome:  'allow' | 'step_up' | 'pause'
export const MOCK_DECISION = 'step_up'
// The no-consent beat is NOT selected here — it triggers automatically when the
// customer declines biometric consent (payload.consent.biometrics === false),
// and the granted re-run triggers on consent.temporary === true.
// ============================================================================

const SCRIPTS = {
  allow: {
    transaction: {
      steps: ['Loaded transaction slice', 'Amount $60 vs typical $50–$200 — in range', 'Payee previously paid — no novelty'],
      result: { score: 12, confidence: 'high', rationale: 'Amount and payee are consistent with this customer’s routine daytime activity.' },
    },
    context: {
      steps: ['Loaded context slice', 'Place: home — matches typical locations', 'Local time inside usual active hours'],
      result: { score: 9, confidence: 'high', rationale: 'Familiar location during typical active hours.' },
    },
    biometric: {
      steps: ['Consent check → granted', 'Tool call: HealthKit (mock) → heart rate 66 bpm', 'HR 66 vs resting 62 — near baseline'],
      result: { score: 16, confidence: 'medium', rationale: 'Heart rate and respiration are near resting baseline.' },
    },
    behavior: {
      steps: ['Loaded live session telemetry', 'Typing cadence variance normal for customer', 'Pointer path organic — no automation markers'],
      result: { score: 11, confidence: 'high', rationale: 'Typing rhythm and cursor movement match the customer’s usual pattern.' },
    },
    adjudication: {
      decision: 'allow', risk_score: 12, step_up_method: null, customer_message: '',
      reasoning: 'All four independent signals are low; nothing about this payment is unusual for this customer.',
    },
  },

  step_up: {
    transaction: {
      steps: ['Loaded transaction slice', 'Escalated: first-seen payee, amount above typical range', 'Velocity check: first transaction this hour — 1:04 AM'],
      result: { score: 74, confidence: 'high', rationale: 'First-ever payment to this recipient, at 1 AM, well above the customer’s typical range.' },
    },
    context: {
      steps: ['Loaded context slice', 'Place: major rail hub, 6.2 km from home', 'Local time 1:04 AM — inside usual sleep window'],
      result: { score: 68, confidence: 'medium', rationale: 'Customer is at a major rail hub at 1 AM, far from home, during usual sleep hours.' },
    },
    biometric: {
      steps: ['Consent check → granted', 'Tool call: HealthKit (mock) → heart rate 118 bpm', 'Tool call: HealthKit (mock) → respiration 22, skin temp +0.8°C', 'Activity state: stationary — exertion ruled out'],
      result: { score: 81, confidence: 'high', rationale: 'Heart rate is 45% above resting baseline with no physical activity to explain it.' },
    },
    behavior: {
      steps: ['Loaded live session telemetry', 'Hesitation before Send within human range', 'Input cadence irregular — consistent with a real person'],
      result: { score: 22, confidence: 'high', rationale: 'Input cadence and pointer movement look like a real, unassisted human.' },
    },
    adjudication: {
      decision: 'step_up', risk_score: 82, step_up_method: 'questions',
      customer_message:
        'Before this payment goes through, we’d like to check in. Is someone asking or instructing you to make this payment right now? Take a moment — a genuine payment can always wait a minute.',
      reasoning: 'Elevated stress, unusual context and an anomalous first-time payment converge while behavior confirms a real human is present — the coercion pattern.',
    },
  },

  pause: {
    transaction: {
      steps: ['Loaded transaction slice', 'Escalated: amount empties most of available balance', 'Payee never seen before'],
      result: { score: 71, confidence: 'high', rationale: 'Large first-time payment that empties most of the available balance.' },
    },
    context: {
      steps: ['Loaded context slice', 'Session environment unrecognized for this customer'],
      result: { score: 57, confidence: 'medium', rationale: 'Session originates from an unrecognized environment for this customer.' },
    },
    biometric: {
      steps: ['Consent check → granted', 'Tool call: HealthKit (mock) → no wearable stream'],
      result: { score: 38, confidence: 'low', rationale: 'No wearable signal is available for this session.' },
    },
    behavior: {
      steps: ['Loaded live session telemetry', 'Typing cadence variance ~0 ms — machine-constant', 'Pointer path perfectly linear — automation marker', 'All fields filled by paste'],
      result: { score: 93, confidence: 'high', rationale: 'Machine-perfect input cadence and a perfectly linear pointer path indicate automation or remote control.' },
    },
    adjudication: {
      decision: 'pause', risk_score: 88, step_up_method: null,
      customer_message:
        'This payment has been paused for your security. No money has left your account. Please confirm this payment from the mobile app on your own device, or contact us — we’re here to help.',
      reasoning: 'A high automation signal corroborated by an anomalous transaction indicates the session may not be under the customer’s control.',
    },
  },

  // Biometric consent declined → shield skipped, remaining signals borderline →
  // adjudicator offers one-time biometric permission (the headline demo beat).
  no_consent: {
    transaction: {
      steps: ['Loaded transaction slice', 'Escalated: first-seen payee, amount above typical range'],
      result: { score: 64, confidence: 'medium', rationale: 'First-time payee and an amount above this customer’s typical range.' },
    },
    context: {
      steps: ['Loaded context slice', 'Shopping district in the evening — plausible but unverified'],
      result: { score: 52, confidence: 'medium', rationale: 'Unfamiliar but plausible location during waking hours.' },
    },
    biometric: {
      steps: ['Consent check → declined'],
      result: {
        score: 50, confidence: 'low', consent_declined: true,
        rationale: 'Biometric signals unavailable — customer has not granted permission.',
      },
    },
    behavior: {
      steps: ['Loaded live session telemetry', 'Interaction pattern within human range'],
      result: { score: 44, confidence: 'medium', rationale: 'Interaction telemetry is broadly human but not distinctive enough to be conclusive.' },
    },
    adjudication: {
      decision: 'step_up', risk_score: 58, step_up_method: 'temporary_biometric_permission',
      customer_message:
        'We’d like to complete this transfer with one extra safeguard. If you allow a one-time wellness reading from your connected wearable, we can confirm everything looks normal and send your payment now. Nothing is stored — we analyze, never keep.',
      reasoning: 'With biometrics unavailable by choice and every remaining signal borderline, a one-time biometric read is the least intrusive way to resolve the ambiguity.',
    },
  },

  // Full re-run after the customer grants one-time access.
  granted_rerun: {
    transaction: {
      steps: ['Loaded transaction slice', 'Re-check: same payment, no new velocity'],
      result: { score: 64, confidence: 'medium', rationale: 'Payment remains above typical range for a first-time payee.' },
    },
    context: {
      steps: ['Loaded context slice', 'Location unchanged since first evaluation'],
      result: { score: 52, confidence: 'medium', rationale: 'Unfamiliar but plausible location during waking hours.' },
    },
    biometric: {
      steps: ['Temporary permission granted — one-time read', 'Tool call: HealthKit (mock) → heart rate 74 bpm', 'HR 74 vs resting 62, respiration 15 — calm'],
      result: { score: 18, confidence: 'high', rationale: 'Readings are calm and near this customer’s resting baseline.' },
    },
    behavior: {
      steps: ['Loaded live session telemetry', 'Interaction pattern within human range'],
      result: { score: 44, confidence: 'medium', rationale: 'Interaction telemetry is broadly human but not distinctive enough to be conclusive.' },
    },
    adjudication: {
      decision: 'allow', risk_score: 34, step_up_method: null, customer_message: '',
      reasoning: 'The one-time biometric read shows a calm customer, resolving the earlier ambiguity; remaining signals do not converge on risk.',
    },
  },
}

const SHIELD_ORDER = ['transaction', 'context', 'biometric', 'behavior']

// Emits v2 events with demo-friendly staggering, like the Phase 4 SSE stream.
// Returns a cancel function (clears pending timers if the modal closes).
export function mockEvaluate(payload, onEvent) {
  const timers = []
  const at = (ms, evt) => timers.push(setTimeout(() => onEvent(evt), ms))

  if (payload.challenge_passed) {
    at(1000, {
      type: 'adjudication', decision: 'allow', risk_score: 24, step_up_method: null,
      customer_message: '',
      reasoning: 'Customer confirmed the payment context under a step-up challenge.',
    })
    return () => timers.forEach(clearTimeout)
  }

  if (payload.consent?.offer_declined) {
    // Customer ignored the one-time offer: the Adjudicator re-decides from the
    // three available signals (shield results are already in hand server-side).
    // Never re-offers the permission; declining is not itself evidence of risk.
    at(1800, {
      type: 'adjudication', decision: 'step_up', risk_score: 61, step_up_method: 'questions',
      customer_message:
        'No problem — let’s just take a quick moment together. Is someone asking or instructing you to make this payment right now? A genuine payment can always wait a minute.',
      reasoning: 'With biometrics unavailable by choice, the remaining borderline signals warrant a brief check-in rather than a decline for this first-time payment.',
    })
    return () => timers.forEach(clearTimeout)
  }

  const script =
    payload.consent?.temporary ? SCRIPTS.granted_rerun
    : payload.consent?.biometrics === false ? SCRIPTS.no_consent
    : SCRIPTS[MOCK_DECISION]

  let latest = 0
  SHIELD_ORDER.forEach((shield, i) => {
    const { steps, result } = script[shield]
    let t = 500 + i * 650
    for (const text of steps) {
      at(t, { type: 'step', shield, text })
      t += 650
    }
    at(t, { type: 'result', shield, ...result, steps })
    latest = Math.max(latest, t)
  })
  at(latest + 1000, { type: 'adjudication', ...script.adjudication })
  return () => timers.forEach(clearTimeout)
}
