"""Real shield orchestration (Phase 7).

Every score, step-decision and adjudication comes from a real LLM call; only
the SENSOR DATA and TOOLS are fixtures/mocks (core principle: mock the
evidence, never the judgment).

Per shield:
- low stakes  → ONE full-slice call.
- escalated   → staged: (1) initial minimal-signal call (_staged_initial
  prompt) → mock tool step events → (2) full-slice call.
Shields run in parallel (asyncio.gather); each streams its steps live and its
result the moment it completes. The Adjudicator runs last on the four results.

Consent: if biometrics are declined the Biometric Shield is NOT called — the
neutral declined result is injected. On escalated streaming runs the server
emits consent_request and WAITS for the customer (api/respond) before
adjudicating; a grant triggers a real one-time biometric call.

Every prompt+response is logged to runs/run_<ts>_<id>.json for debugging and
rehearsal screenshots.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from .llm import (
    ADJUDICATOR_FALLBACK,
    RETRY_NUDGE,
    SENTINEL_FALLBACK,
    SHIELD_FALLBACK,
    STAGED_FALLBACK,
    LLMError,
    chat,
    extract_json,
    resolve_model,
    validate_adjudicator,
    validate_sentinel,
    validate_shield,
    validate_staged_initial,
)
from .prompts import PROMPTS, staged_initial_prompt

RUNS_DIR = Path(__file__).resolve().parent.parent / "runs"

SHIELD_ORDER = ["transaction", "context", "biometric", "behavior"]

# Escalated call 1: the minimal initial signal each shield starts from.
def _initial_slice(key: str, slices: dict) -> dict:
    s = slices[key]
    if key == "transaction":
        txn = s["transaction"]
        return {"transaction": {"amount": txn.get("amount"), "payee_first_seen": txn.get("payee_first_seen")},
                "baseline": {"typical_txn_range_usd": s["baseline"].get("typical_txn_range_usd")}}
    if key == "biometric":
        return {"biometrics": {"heart_rate": s["biometrics"].get("heart_rate")},
                "baseline": {"resting_hr": s["baseline"].get("resting_hr")}}
    if key == "context":
        return {"context": {"place": s["context"].get("place")},
                "baseline": {"typical_locations": s["baseline"].get("typical_locations")}}
    # Two signals, not one — a single low-linearity number reads as "automation"
    # to small models even though lower linearity is the human direction.
    return {"telemetry": {"mouse_path_linearity": s["telemetry"].get("mouse_path_linearity"),
                          "typing_cadence_var_ms": s["telemetry"].get("typing_cadence_var_ms")},
            "baseline": {"typical_mouse_linearity": s["baseline"].get("typical_mouse_linearity"),
                         "typical_cadence_var_ms": s["baseline"].get("typical_cadence_var_ms")}}


# Between staged calls: honest mock tool fetches ((mock) label per contract).
TOOL_STEPS = {
    "transaction": "Tool call: ledger service (mock) → 24h velocity, balance share",
    "biometric": "Tool call: HealthKit (mock) → respiration, skin temp, activity state",
    "context": "Tool call: location service (mock) → home distance, location history",
    "behavior": "Tool call: session recorder (mock) → typing cadence, hesitation, field fill",
}

# The shield slice sent to the model (consent flag is orchestration metadata,
# not shield evidence — scope isolation).
def _model_slice(key: str, slices: dict) -> dict:
    return {k: v for k, v in slices[key].items() if k != "consent"}


DECLINED_BIOMETRIC = {
    "score": 50,
    "confidence": "low",
    "rationale": "Biometric signals unavailable — customer has not granted permission.",
    "consent_declined": True,
}

# System-level offer copy (the ask is triggered by escalation + declined
# consent, not by the adjudicator — it fires while shields still work).
CONSENT_OFFER_MESSAGE = (
    "We'd like to complete this transfer with one extra safeguard. If you allow "
    "a one-time wellness reading from your connected wearable, we can confirm "
    "everything looks normal and send your payment now. Nothing is stored — "
    "we analyze, never keep."
)


async def traced_call(label: str, agent_key: str, system: str, payload: dict,
                      validator, fallback: dict, log: list) -> dict:
    """chat → parse → one retry → fallback, recording every attempt raw."""
    model = resolve_model(agent_key)
    user = json.dumps(payload)
    entry = {"agent": agent_key, "call": label, "model": model,
             "user_payload": payload, "attempts": [], "fallback": False}
    log.append(entry)
    try:
        text = await chat(system, user, model=model)
    except LLMError as exc:
        entry["attempts"].append({"transport_error": str(exc)})
        entry["fallback"] = True
        return dict(fallback)
    for attempt in (1, 2):
        entry["attempts"].append({"raw": text})
        try:
            parsed = validator(extract_json(text))
            entry["parsed"] = parsed
            return parsed
        except ValueError as exc:
            entry["attempts"][-1]["parse_error"] = str(exc)
            if attempt == 2:
                break
            try:
                text = await chat(system, f"{user}\n\n{RETRY_NUDGE}", model=model)
            except LLMError as exc2:
                entry["attempts"].append({"transport_error": str(exc2)})
                break
    entry["fallback"] = True
    return dict(fallback)


async def _run_shield(key: str, slices: dict, escalated: bool, emit, log: list) -> dict:
    steps: list[str] = []

    async def step(text: str, pause: float = 0.15):
        steps.append(text)
        await emit({"type": "step", "shield": key, "text": text})
        await asyncio.sleep(pause)

    if key == "biometric":
        await step("Consent check → granted")

    if escalated:
        await step("Escalated payment — staged evaluation")
        initial = await traced_call(
            "initial", key, staged_initial_prompt(key),
            _initial_slice(key, slices), validate_staged_initial, STAGED_FALLBACK, log,
        )
        await step(f"Initial read ({initial['preliminary_score']}/100): {initial['step']}")
        if initial["need_more"]:
            await step(TOOL_STEPS[key])
        else:
            await step("Initial signal sufficient — confirming with full slice")

    else:
        await step(f"Loaded {key} slice")

    result = await traced_call(
        "full", key, PROMPTS[key], _model_slice(key, slices),
        validate_shield, SHIELD_FALLBACK, log,
    )
    for model_step in result.get("steps", []):
        await step(model_step, pause=0.2)

    # model/escalated are dev-overlay metadata (CONTRACTS.md v2.1) — the
    # adjudicator never sees them (_assessment_view whitelists its input).
    combined = {**result, "steps": steps,
                "model": resolve_model(key), "escalated": escalated}
    await emit({"type": "result", "shield": key, **combined})
    return combined


async def _run_biometric_granted(slices: dict, emit, log: list) -> dict:
    """One-time read after a mid-run grant."""
    key = "biometric"
    steps: list[str] = []

    async def step(text: str, pause: float = 0.15):
        steps.append(text)
        await emit({"type": "step", "shield": key, "text": text})
        await asyncio.sleep(pause)

    await step("Temporary permission granted — one-time read")
    await step(TOOL_STEPS[key])
    result = await traced_call(
        "full", key, PROMPTS[key], _model_slice(key, slices),
        validate_shield, SHIELD_FALLBACK, log,
    )
    for model_step in result.get("steps", []):
        await step(model_step, pause=0.2)
    combined = {**result, "steps": steps,
                "model": resolve_model(key), "escalated": True}
    await emit({"type": "result", "shield": key, **combined})
    return combined


def _assessment_view(result: dict) -> dict:
    """What the Adjudicator sees per shield: score/confidence/rationale only.
    Step traces are UI/audit theater — feeding their narrative text to the
    adjudicator measurably poisons it (observed: it parroted a staged-initial
    "suggesting automation" step while the final score was 35)."""
    view = {k: result[k] for k in ("score", "confidence", "rationale") if k in result}
    if result.get("consent_declined"):
        view["consent_declined"] = True
    if result.get("skipped"):
        view["skipped"] = True
    return view


def _skipped_result(note: str) -> dict:
    """Neutral placeholder for a shield the Sentinel chose not to run — same
    no-information shape the adjudicator already handles for declined consent."""
    return {
        "score": 50,
        "confidence": "low",
        "rationale": note or "Not evaluated — the on-device Sentinel concluded from the other signals.",
        "steps": ["Sentinel decision → skipped"],
        "skipped": True,
    }


def _evidence_view(results: dict) -> dict:
    """What the Sentinel sees per completed shield — same whitelist discipline
    as the adjudicator: score/confidence/rationale, never step text."""
    return {k: _assessment_view(v) for k, v in results.items()}


async def run_evaluation(run_id: str, scenario: str, payload: dict, slices: dict,
                         escalated: bool, emit, response_q: asyncio.Queue | None) -> dict:
    """Full run: Sentinel-routed shields → optional consent wait → adjudication.

    The on-device Sentinel (a real LLM) decides which shields to invoke, in
    which order or parallel batches, and which to skip — observe → reason →
    act, looped. A Sentinel failure degrades to the pre-Sentinel behavior:
    every remaining shield runs in parallel, nothing is skipped.

    response_q is not None only for interactive runs (consent declined +
    escalated + streaming): the consent_request is emitted early and the
    adjudication is withheld until the customer answers.
    """
    log: list = []
    consent = dict(slices["_consent"])
    declined = consent.get("biometrics") is False
    results: dict[str, dict] = {}

    async def do_shield(k: str):
        results[k] = await _run_shield(k, slices, escalated, emit, log)

    async def sentinel_step(text: str):
        await emit({"type": "step", "shield": "sentinel", "text": text})
        await asyncio.sleep(0.15)

    await emit({"type": "sentinel", "model": resolve_model("sentinel")})

    remaining = list(SHIELD_ORDER)
    if declined:
        # Biometrics are off the table until the customer says otherwise —
        # the Sentinel routes around them; the platform owns the consent ask.
        remaining.remove("biometric")
        steps = ["Consent check → declined"]
        await emit({"type": "step", "shield": "biometric", "text": steps[0]})
        bio = {**DECLINED_BIOMETRIC, "steps": steps}
        await emit({"type": "result", "shield": "biometric", **bio})
        results["biometric"] = bio
        if response_q is not None:
            await sentinel_step("Biometric consent not granted — asking for a one-time reading.")
            await emit({"type": "consent_request",
                        "method": "temporary_biometric_permission",
                        "message": CONSENT_OFFER_MESSAGE})

    # Sentinel context: transaction-level facts only (scope isolation — the
    # Sentinel routes on stakes and evidence summaries, never raw signals).
    sentinel_ctx = {
        "transaction": payload.get("transaction", {}),
        "baseline": slices["transaction"]["baseline"],
        "consent": {"biometrics": consent.get("biometrics", True)},
        "escalated": escalated,
    }
    if slices.get("_sentinel_hint"):
        sentinel_ctx["device_hint"] = slices["_sentinel_hint"]

    txn = payload.get("transaction", {}) or {}
    rng = (slices["transaction"]["baseline"].get("typical_txn_range_usd") or [0, 0])

    def routing_summary() -> dict:
        """Deterministic routing facts — same philosophy as the adjudicator's
        signal_summary: the platform does the arithmetic so the 8B-class
        Sentinel spends its judgment on WHY, not on reading numbers."""
        scores = [v["score"] for v in results.values()
                  if not v.get("consent_declined") and not v.get("_fallback")
                  and not v.get("skipped")]
        return {
            "escalated": escalated,
            "amount_vs_typical_range": "above" if (txn.get("amount") or 0) > rng[1] else "within",
            "first_seen_payee": bool(txn.get("payee_first_seen")),
            "device_hint_present": bool(slices.get("_sentinel_hint")),
            "first_decision": not scores,
            "max_evidence_score": max(scores) if scores else None,
            "all_evidence_low_45_or_less": bool(scores) and max(scores) <= 45,
            "anomaly_55_or_more": any(s >= 55 for s in scores),
        }

    for round_no in range(1, 5):  # decision cap — a demo run never loops forever
        if not remaining:
            break
        summary = routing_summary()
        route_payload = {**sentinel_ctx, "routing_summary": summary,
                         "evidence": _evidence_view(results),
                         "remaining_shields": list(remaining)}
        decision = await traced_call(
            f"route_{round_no}", "sentinel", PROMPTS["sentinel"],
            route_payload, validate_sentinel, SENTINEL_FALLBACK, log,
        )
        # Routing-rule compliance check (mirrors the adjudicator's policy-floor
        # nudge). Rules 1-5 are deterministic given routing_summary; when the
        # model's invoke set deviates, tell it which rule applies and let it
        # re-decide ONCE — then accept its answer either way. The gray band
        # (max evidence 46-54) and every narration stay the model's judgment.
        def _expected_invoke() -> tuple[set, str] | None:
            hint_targets = {k for k in ("biometric", "context") if k in remaining}
            if summary["device_hint_present"] and hint_targets:
                return hint_targets, ("rule 1: a device hint is present — it must be "
                                      "explained before anything else")
            if summary["first_decision"]:
                if escalated:
                    return ({k for k in ("context", "transaction") if k in remaining},
                            "rule 3: escalated first decision — establish where and how far off-pattern")
                return ({k for k in ("transaction", "behavior") if k in remaining},
                        "rule 2: routine first decision — the free on-device checks only")
            if summary["anomaly_55_or_more"]:
                return (set(remaining),
                        "rule 4: an anomaly needs corroborating from every remaining angle")
            if summary["all_evidence_low_45_or_less"]:
                return (set(),
                        "rule 5: every score is 45 or below — conclude and skip the rest")
            return None

        expected = _expected_invoke()
        if (not decision.get("_fallback") and expected is not None
                and set(decision["invoke"]) != expected[0]):
            want = sorted(expected[0]) if expected[0] else "nothing — conclude"
            reconsidered = await traced_call(
                f"route_{round_no}_reconsider", "sentinel", PROMPTS["sentinel"],
                {**route_payload, "policy_note": (
                    f"Compliance check: per the routing rules ({expected[1]}), "
                    f"this decision must invoke exactly {want}. "
                    f"Re-decide and return your JSON decision.")},
                validate_sentinel, SENTINEL_FALLBACK, log,
            )
            if not reconsidered.get("_fallback"):
                decision = reconsidered
        for line in decision["thinking"]:
            await sentinel_step(line)
        if decision.get("_fallback"):
            invoke = list(remaining)  # degrade to the pre-Sentinel parallel run
        else:
            invoke = [k for k in dict.fromkeys(decision["invoke"]) if k in remaining]
        if invoke:
            reason = decision["thinking"][-1] if decision["thinking"] else ""
            for k in invoke:
                await emit({"type": "invoke", "shield": k, "reason": reason})
            await asyncio.gather(*(do_shield(k) for k in invoke))
            for k in invoke:
                remaining.remove(k)
            continue
        # Conclude: whatever remains was judged unnecessary.
        for k in list(remaining):
            skipped = _skipped_result(decision.get("skip_note", ""))
            results[k] = skipped
            await emit({"type": "result", "shield": k, **skipped})
        remaining = []
        break
    if remaining:
        # Decision cap reached mid-investigation: finish, never silently drop.
        await sentinel_step("Decision limit reached — completing the remaining checks.")
        for k in remaining:
            await emit({"type": "invoke", "shield": k, "reason": "completing remaining checks"})
        await asyncio.gather(*(do_shield(k) for k in remaining))
        remaining = []

    if declined and response_q is not None:
        grant = await response_q.get()  # ← the Adjudicator waits for the human
        if grant:
            consent = {"biometrics": True, "temporary": True}
            results["biometric"] = await _run_biometric_granted(slices, emit, log)
        else:
            consent["offer_declined"] = True

    # Deterministic feature extraction: 8B-class adjudicators occasionally
    # hallucinate signal levels; the platform computes the arithmetic so the
    # model spends its judgment on WHY, not on reading numbers.
    informative = {k: v["score"] for k, v in results.items()
                   if not v.get("consent_declined") and not v.get("_fallback")
                   and not v.get("skipped")}
    skipped_shields = [k for k in SHIELD_ORDER if results.get(k, {}).get("skipped")]
    adj_payload = {
        "assessments": {k: _assessment_view(v) for k, v in results.items()},
        "signal_summary": {
            "informative_scores": informative,
            "max_informative_score": max(informative.values(), default=0),
            "biometrics_available": "biometric" in informative,
            "skipped_shields": skipped_shields,
        },
        "transaction": payload.get("transaction", {}),
        "consent": consent,
    }
    adjudication = await traced_call(
        "adjudicate", "adjudicator", PROMPTS["adjudicator"],
        adj_payload, validate_adjudicator, ADJUDICATOR_FALLBACK, log,
    )

    # Policy-floor compliance check: if the verdict violates the floor (all
    # informative signals < 60, biometrics available, yet not "allow"), tell
    # the Adjudicator and let it re-decide ONCE. Still the model's judgment;
    # a floor violation only ever errs toward caution, so if it persists we
    # accept it.
    summary = adj_payload["signal_summary"]
    floor_applies = (summary["biometrics_available"]
                     or "biometric" in summary["skipped_shields"])
    if (floor_applies and summary["max_informative_score"] < 60
            and adjudication["decision"] != "allow" and not adjudication.get("_fallback")):
        bio_state = ("biometrics are available" if summary["biometrics_available"]
                     else "the biometric probe was intentionally skipped by the Sentinel")
        reconsider_payload = {**adj_payload, "policy_note": (
            f"Compliance check: signal_summary.max_informative_score is "
            f"{summary['max_informative_score']} (below 60) and {bio_state}. "
            f"Your previous decision {adjudication['decision']!r} "
            f"violates the POLICY FLOOR, which requires 'allow' in this case. "
            f"Re-evaluate and return your JSON decision.")}
        reconsidered = await traced_call(
            "adjudicate_reconsider", "adjudicator", PROMPTS["adjudicator"],
            reconsider_payload, validate_adjudicator, ADJUDICATOR_FALLBACK, log,
        )
        if not reconsidered.get("_fallback"):
            adjudication = reconsidered

    await emit({"type": "adjudication", **adjudication,
                "model": resolve_model("adjudicator")})

    record = {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scenario": scenario,
        "escalated": escalated,
        "consent": consent,
        "request_payload": payload,
        "calls": log,
        "results": results,
        "adjudication": adjudication,
    }
    try:
        RUNS_DIR.mkdir(exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        (RUNS_DIR / f"run_{ts}_{run_id}.json").write_text(
            json.dumps(record, indent=2), encoding="utf-8")
    except OSError as exc:  # logging must never kill a run
        print(f"[run-log] failed to write run log: {exc}")
    return record
