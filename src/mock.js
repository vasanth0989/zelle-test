// Mocked agent results, same shapes as docs/CONTRACTS.md. Replaced by the real
// backend in Phase 4 — until then this module IS the server.
//
// ============================================================================
// EDIT ME to demo a different outcome:  'allow' | 'step_up' | 'pause'
export const MOCK_DECISION = 'pause'
// ============================================================================

const RESULTS = {
  allow: {
    transaction: { score: 12, confidence: 'high', rationale: 'Amount and payee are consistent with this customer’s routine daytime activity.' },
    biometric: { score: 16, confidence: 'medium', rationale: 'Heart rate and respiration are near resting baseline.' },
    context: { score: 9, confidence: 'high', rationale: 'Familiar location during typical active hours.' },
    behavior: { score: 11, confidence: 'high', rationale: 'Typing rhythm and cursor movement match the customer’s usual pattern.' },
    adjudicator: {
      decision: 'allow', risk_score: 12, customer_message: '',
      reasoning: 'All four independent signals are low; nothing about this payment is unusual for this customer.',
    },
  },
  step_up: {
    transaction: { score: 74, confidence: 'high', rationale: 'First-ever payment to this recipient, at 1 AM, well above the customer’s typical range.' },
    biometric: { score: 81, confidence: 'high', rationale: 'Heart rate is 45% above resting baseline with no physical activity to explain it.' },
    context: { score: 68, confidence: 'medium', rationale: 'Customer is at a major rail hub at 1 AM, far from home, during usual sleep hours.' },
    behavior: { score: 22, confidence: 'high', rationale: 'Input cadence and pointer movement look like a real, unassisted human.' },
    adjudicator: {
      decision: 'step_up', risk_score: 82,
      customer_message:
        'Before this payment goes through, we’d like to check in. Is someone asking or instructing you to make this payment right now? Take a moment — a genuine payment can always wait a minute.',
      reasoning: 'Elevated stress, unusual context and an anomalous first-time payment converge while behavior confirms a real human is present — the coercion pattern.',
    },
  },
  pause: {
    transaction: { score: 71, confidence: 'high', rationale: 'Large first-time payment that empties most of the available balance.' },
    biometric: { score: 38, confidence: 'low', rationale: 'No wearable signal is available for this session.' },
    context: { score: 57, confidence: 'medium', rationale: 'Session originates from an unrecognized environment for this customer.' },
    behavior: { score: 93, confidence: 'high', rationale: 'Machine-perfect input cadence and a perfectly linear pointer path indicate automation or remote control.' },
    adjudicator: {
      decision: 'pause', risk_score: 88,
      customer_message:
        'This payment has been paused for your security. No money has left your account. Please confirm this payment from the mobile app on your own device, or contact us — we’re here to help.',
      reasoning: 'A high automation signal corroborated by an anomalous transaction indicates the session may not be under the customer’s control.',
    },
  },
}

// Emits agent events staggered, like the Phase 4 SSE stream will.
// Returns a cancel function (clears pending timers if the modal closes).
export function mockEvaluate(payload, onEvent) {
  const timers = []
  if (payload.challenge_passed) {
    // Per CONTRACTS.md: re-submit with challenge_passed=true → server returns allow.
    timers.push(setTimeout(() => onEvent({
      agent: 'adjudicator', decision: 'allow', risk_score: 24, customer_message: '',
      reasoning: 'Customer confirmed the payment context under a step-up challenge.',
    }), 1000))
  } else {
    const r = RESULTS[MOCK_DECISION]
    const delays = { transaction: 1100, context: 2000, biometric: 2800, behavior: 3500 }
    for (const [agent, ms] of Object.entries(delays)) {
      timers.push(setTimeout(() => onEvent({ agent, ...r[agent] }), ms))
    }
    timers.push(setTimeout(() => onEvent({ agent: 'adjudicator', ...r.adjudicator }), 4600))
  }
  return () => timers.forEach(clearTimeout)
}
