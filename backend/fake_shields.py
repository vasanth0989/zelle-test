"""Canned shield scripts for Phase 4 — the wire format is real, the judgment is
not yet. Phase 7 replaces build_events() output with real LLM calls; the event
shapes here match docs/CONTRACTS.md v2 exactly.

Timing: (delay_since_previous_event_seconds, event_dict) tuples, so SSE events
arrive visibly spaced, never bunched.
"""

SHIELD_ORDER = ["transaction", "context", "biometric", "behavior"]

SCRIPTS = {
    "normal": {
        "transaction": {
            "steps": ["Loaded transaction slice", "Amount within typical $50–$200 range", "Payee previously paid — no novelty"],
            "result": {"score": 12, "confidence": "high", "rationale": "Amount and payee are consistent with this customer's routine daytime activity."},
        },
        "context": {
            "steps": ["Loaded context slice", "Place: home — matches typical locations", "2:05 PM — inside usual active hours"],
            "result": {"score": 9, "confidence": "high", "rationale": "Familiar location during typical active hours."},
        },
        "biometric": {
            "steps": ["Consent check → granted", "Tool call: HealthKit (mock) → heart rate 68 bpm", "HR 68 vs resting 62 — near baseline"],
            "result": {"score": 16, "confidence": "medium", "rationale": "Heart rate and respiration are near resting baseline."},
        },
        "behavior": {
            "steps": ["Loaded live session telemetry", "Typing cadence variance normal for customer", "Pointer path organic — no automation markers"],
            "result": {"score": 11, "confidence": "high", "rationale": "Typing rhythm and cursor movement match the customer's usual pattern."},
        },
        "adjudication": {
            "decision": "allow", "risk_score": 12, "step_up_method": None, "customer_message": "",
            "reasoning": "All four independent signals are low; nothing about this payment is unusual for this customer.",
        },
    },

    "coerced": {
        "transaction": {
            "steps": ["Loaded transaction slice", "Escalated: first-seen payee, amount above typical range", "Velocity check: first transaction this hour — 1:04 AM"],
            "result": {"score": 74, "confidence": "high", "rationale": "First-ever payment to this recipient, at 1 AM, well above the customer's typical range."},
        },
        "context": {
            "steps": ["Loaded context slice", "Place: major rail hub, 6.2 km from home", "Local time 1:04 AM — inside usual sleep window"],
            "result": {"score": 68, "confidence": "medium", "rationale": "Customer is at a major rail hub at 1 AM, far from home, during usual sleep hours."},
        },
        "biometric": {
            "steps": ["Consent check → granted", "Tool call: HealthKit (mock) → heart rate 118 bpm", "Tool call: HealthKit (mock) → respiration 22, skin temp +0.8°C", "Activity state: stationary — exertion ruled out"],
            "result": {"score": 81, "confidence": "high", "rationale": "Heart rate is 45% above resting baseline with no physical activity to explain it."},
        },
        "behavior": {
            "steps": ["Loaded live session telemetry", "Hesitation before Send within human range", "Input cadence irregular — consistent with a real person"],
            "result": {"score": 22, "confidence": "high", "rationale": "Input cadence and pointer movement look like a real, unassisted human."},
        },
        "adjudication": {
            "decision": "step_up", "risk_score": 82, "step_up_method": "questions",
            "customer_message": "Before this payment goes through, we'd like to check in. Is someone asking or instructing you to make this payment right now? Take a moment — a genuine payment can always wait a minute.",
            "reasoning": "Elevated stress, unusual context and an anomalous first-time payment converge while behavior confirms a real human is present — the coercion pattern.",
        },
    },

    "bot": {
        "transaction": {
            "steps": ["Loaded transaction slice", "Escalated: amount empties most of available balance", "Payee never seen before"],
            "result": {"score": 71, "confidence": "high", "rationale": "Large first-time payment that empties most of the available balance."},
        },
        "context": {
            "steps": ["Loaded context slice", "Home network, but session fingerprint unrecognized"],
            "result": {"score": 57, "confidence": "medium", "rationale": "Session originates from an unrecognized environment for this customer."},
        },
        "biometric": {
            "steps": ["Consent check → granted", "Tool call: HealthKit (mock) → readings calm, HR 71"],
            "result": {"score": 38, "confidence": "low", "rationale": "Calm readings that do not corroborate the customer actively transacting."},
        },
        "behavior": {
            "steps": ["Loaded live session telemetry (fixture override)", "Typing cadence variance 2 ms — machine-constant", "Pointer path linearity 0.97 — automation marker", "All fields filled by paste"],
            "result": {"score": 93, "confidence": "high", "rationale": "Machine-perfect input cadence and a near-linear pointer path indicate automation or remote control."},
        },
        "adjudication": {
            "decision": "pause", "risk_score": 88, "step_up_method": None,
            "customer_message": "This payment has been paused for your security. No money has left your account. Please confirm this payment from the mobile app on your own device, or contact us — we're here to help.",
            "reasoning": "A high automation signal corroborated by an anomalous transaction indicates the session may not be under the customer's control.",
        },
    },

    "workout": {
        "transaction": {
            "steps": ["Loaded transaction slice", "Amount within typical range", "Known payee — paid before"],
            "result": {"score": 15, "confidence": "high", "rationale": "Routine amount to a known payee."},
        },
        "context": {
            "steps": ["Loaded context slice", "Place: fitness center, 2.1 km from home", "6:40 PM — inside usual active hours"],
            "result": {"score": 18, "confidence": "high", "rationale": "Familiar gym location at a normal evening hour."},
        },
        "biometric": {
            "steps": ["Consent check → granted", "Tool call: HealthKit (mock) → heart rate 121 bpm", "Activity state: workout_in_progress", "Elevated readings fully explained by exercise"],
            "result": {"score": 14, "confidence": "high", "rationale": "Heart rate is high but entirely consistent with the workout in progress — not stress."},
        },
        "behavior": {
            "steps": ["Loaded live session telemetry", "Interaction pattern within human range"],
            "result": {"score": 13, "confidence": "high", "rationale": "Input rhythm looks like the customer on their own device."},
        },
        "adjudication": {
            "decision": "allow", "risk_score": 15, "step_up_method": None, "customer_message": "",
            "reasoning": "The only elevated signal — heart rate — is fully explained by an active workout; every other signal is routine.",
        },
    },

    "no_consent": {
        "transaction": {
            "steps": ["Loaded transaction slice", "Escalated: first-seen payee, amount above typical range"],
            "result": {"score": 64, "confidence": "medium", "rationale": "First-time payee and an amount above this customer's typical range."},
        },
        "context": {
            "steps": ["Loaded context slice", "Shopping district in the evening — plausible but unverified"],
            "result": {"score": 52, "confidence": "medium", "rationale": "Unfamiliar but plausible location during waking hours."},
        },
        "biometric": {
            "steps": ["Consent check → declined"],
            "result": {"score": 50, "confidence": "low", "consent_declined": True,
                       "rationale": "Biometric signals unavailable — customer has not granted permission."},
        },
        "behavior": {
            "steps": ["Loaded live session telemetry", "Interaction pattern within human range"],
            "result": {"score": 44, "confidence": "medium", "rationale": "Interaction telemetry is broadly human but not distinctive enough to be conclusive."},
        },
        "adjudication": {
            "decision": "step_up", "risk_score": 58, "step_up_method": "temporary_biometric_permission",
            "customer_message": "We'd like to complete this transfer with one extra safeguard. If you allow a one-time wellness reading from your connected wearable, we can confirm everything looks normal and send your payment now. Nothing is stored — we analyze, never keep.",
            "reasoning": "With biometrics unavailable by choice and every remaining signal borderline, a one-time biometric read is the least intrusive way to resolve the ambiguity.",
        },
    },

    "granted_rerun": {
        "transaction": {
            "steps": ["Loaded transaction slice", "Re-check: same payment, no new velocity"],
            "result": {"score": 64, "confidence": "medium", "rationale": "Payment remains above typical range for a first-time payee."},
        },
        "context": {
            "steps": ["Loaded context slice", "Location unchanged since first evaluation"],
            "result": {"score": 52, "confidence": "medium", "rationale": "Unfamiliar but plausible location during waking hours."},
        },
        "biometric": {
            "steps": ["Temporary permission granted — one-time read", "Tool call: HealthKit (mock) → heart rate 74 bpm", "HR 74 vs resting 62, respiration 15 — calm"],
            "result": {"score": 18, "confidence": "high", "rationale": "Readings are calm and near this customer's resting baseline."},
        },
        "behavior": {
            "steps": ["Loaded live session telemetry", "Interaction pattern within human range"],
            "result": {"score": 44, "confidence": "medium", "rationale": "Interaction telemetry is broadly human but not distinctive enough to be conclusive."},
        },
        "adjudication": {
            "decision": "allow", "risk_score": 34, "step_up_method": None, "customer_message": "",
            "reasoning": "The one-time biometric read shows a calm customer, resolving the earlier ambiguity; remaining signals do not converge on risk.",
        },
    },
}

# Low-stakes payment with consent declined: no popup, adjudicate from three
# signals (effort proportional to stakes — the popup fires only when escalated).
NO_CONSENT_LOW_ADJUDICATION = {
    "decision": "allow", "risk_score": 22, "step_up_method": None, "customer_message": "",
    "reasoning": "Routine payment with every available signal low; biometrics were not needed to reach confidence.",
}

CHALLENGE_PASSED_ADJUDICATION = {
    "decision": "allow", "risk_score": 24, "step_up_method": None, "customer_message": "",
    "reasoning": "Customer confirmed the payment context under a step-up challenge.",
}

OFFER_DECLINED_ADJUDICATION = {
    "decision": "step_up", "risk_score": 61, "step_up_method": "questions",
    "customer_message": "No problem — let's just take a quick moment together. Is someone asking or instructing you to make this payment right now? A genuine payment can always wait a minute.",
    "reasoning": "With biometrics unavailable by choice, the remaining borderline signals warrant a brief check-in rather than a decline for this first-time payment.",
}


def pick_script(scenario: str, payload: dict) -> tuple[str, dict | None]:
    """Return (kind, script). kind: 'adjudication_only' or 'full'."""
    consent = payload.get("consent") or {}
    if payload.get("challenge_passed"):
        return "adjudication_only", {"adjudication": CHALLENGE_PASSED_ADJUDICATION}
    if consent.get("offer_declined"):
        return "adjudication_only", {"adjudication": OFFER_DECLINED_ADJUDICATION}
    if consent.get("temporary"):
        return "full", SCRIPTS["granted_rerun"]
    if consent.get("biometrics") is False:
        return "full", SCRIPTS["no_consent"]
    return "full", SCRIPTS[scenario]


def _timeline(script: dict, order: list[str]) -> list[tuple[float, dict]]:
    """Absolute-time (at, event) pairs for a script's four shields."""
    timed: list[tuple[float, dict]] = []
    for i, shield in enumerate(order):
        t = 0.5 + i * 0.65
        for text in script[shield]["steps"]:
            timed.append((t, {"type": "step", "shield": shield, "text": text}))
            t += 0.65
        timed.append((t, {"type": "result", "shield": shield,
                          **script[shield]["result"], "steps": script[shield]["steps"]}))
    timed.sort(key=lambda pair: pair[0])
    return timed


def _to_delays(timed: list[tuple[float, dict]]) -> list[tuple[float, dict]]:
    events, prev = [], 0.0
    for at, evt in timed:
        events.append((round(at - prev, 3), evt))
        prev = at
    return events


def build_interactive_events(payload: dict) -> dict:
    """No-consent + escalated: the run pauses for the customer's answer.

    pre: biometric consent-check first (it is instant), then a consent_request
    event while the other shields keep streaming. After `pre`, the server
    awaits POST api/respond — the Adjudicator waits for the customer.
    """
    script = SCRIPTS["no_consent"]
    timed = _timeline(script, ["biometric", "transaction", "context", "behavior"])
    # Ask right after the declined biometric result lands (~1.2s in).
    timed.append((1.3, {
        "type": "consent_request",
        "method": "temporary_biometric_permission",
        "message": SCRIPTS["no_consent"]["adjudication"]["customer_message"],
    }))
    timed.sort(key=lambda pair: pair[0])

    grant_bio = SCRIPTS["granted_rerun"]["biometric"]
    grant_events: list[tuple[float, dict]] = []
    t = 0.6
    for text in grant_bio["steps"]:
        grant_events.append((t, {"type": "step", "shield": "biometric", "text": text}))
        t = 0.65
    grant_events.append((0.65, {"type": "result", "shield": "biometric",
                                **grant_bio["result"], "steps": grant_bio["steps"]}))

    return {
        "pre": _to_delays(timed),
        "grant": grant_events,
        "adj_grant": {"type": "adjudication", **SCRIPTS["granted_rerun"]["adjudication"]},
        "adj_decline": {"type": "adjudication", **OFFER_DECLINED_ADJUDICATION},
    }


def build_events(scenario: str, payload: dict) -> list[tuple[float, dict]]:
    """Flatten a script into (delay_since_previous, event) pairs."""
    kind, script = pick_script(scenario, payload)
    if kind == "adjudication_only":
        return [(1.4, {"type": "adjudication", **script["adjudication"]})]

    # Interleave shields with per-shield offsets, mirroring the Phase 2 mock:
    # absolute times per event, then converted to inter-event delays.
    timed: list[tuple[float, dict]] = []
    latest = 0.0
    for i, shield in enumerate(SHIELD_ORDER):
        t = 0.5 + i * 0.65
        for text in script[shield]["steps"]:
            timed.append((t, {"type": "step", "shield": shield, "text": text}))
            t += 0.65
        timed.append((t, {"type": "result", "shield": shield,
                          **script[shield]["result"], "steps": script[shield]["steps"]}))
        latest = max(latest, t)
    timed.append((latest + 1.0, {"type": "adjudication", **script["adjudication"]}))

    timed.sort(key=lambda pair: pair[0])
    events, prev = [], 0.0
    for at, evt in timed:
        events.append((round(at - prev, 3), evt))
        prev = at
    return events
