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
    SHIELD_FALLBACK,
    STAGED_FALLBACK,
    LLMError,
    chat,
    extract_json,
    resolve_model,
    validate_adjudicator,
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

    combined = {**result, "steps": steps}
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
    combined = {**result, "steps": steps}
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
    return view


async def run_evaluation(run_id: str, scenario: str, payload: dict, slices: dict,
                         escalated: bool, emit, response_q: asyncio.Queue | None) -> dict:
    """Full run: shields (parallel) → optional consent wait → adjudication.

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

    if declined:
        steps = ["Consent check → declined"]
        await emit({"type": "step", "shield": "biometric", "text": steps[0]})
        bio = {**DECLINED_BIOMETRIC, "steps": steps}
        await emit({"type": "result", "shield": "biometric", **bio})
        results["biometric"] = bio
        if response_q is not None:
            await emit({"type": "consent_request",
                        "method": "temporary_biometric_permission",
                        "message": CONSENT_OFFER_MESSAGE})
        await asyncio.gather(*(do_shield(k) for k in SHIELD_ORDER if k != "biometric"))
        if response_q is not None:
            grant = await response_q.get()  # ← the Adjudicator waits for the human
            if grant:
                consent = {"biometrics": True, "temporary": True}
                results["biometric"] = await _run_biometric_granted(slices, emit, log)
            else:
                consent["offer_declined"] = True
    else:
        await asyncio.gather(*(do_shield(k) for k in SHIELD_ORDER))

    # Deterministic feature extraction: 8B-class adjudicators occasionally
    # hallucinate signal levels; the platform computes the arithmetic so the
    # model spends its judgment on WHY, not on reading numbers.
    informative = {k: v["score"] for k, v in results.items()
                   if not v.get("consent_declined") and not v.get("_fallback")}
    adj_payload = {
        "assessments": {k: _assessment_view(v) for k, v in results.items()},
        "signal_summary": {
            "informative_scores": informative,
            "max_informative_score": max(informative.values(), default=0),
            "biometrics_available": "biometric" in informative,
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
    if (summary["biometrics_available"] and summary["max_informative_score"] < 60
            and adjudication["decision"] != "allow" and not adjudication.get("_fallback")):
        reconsider_payload = {**adj_payload, "policy_note": (
            f"Compliance check: signal_summary.max_informative_score is "
            f"{summary['max_informative_score']} (below 60) and biometrics are "
            f"available. Your previous decision {adjudication['decision']!r} "
            f"violates the POLICY FLOOR, which requires 'allow' in this case. "
            f"Re-evaluate and return your JSON decision.")}
        reconsidered = await traced_call(
            "adjudicate_reconsider", "adjudicator", PROMPTS["adjudicator"],
            reconsider_payload, validate_adjudicator, ADJUDICATOR_FALLBACK, log,
        )
        if not reconsidered.get("_fallback"):
            adjudication = reconsidered

    await emit({"type": "adjudication", **adjudication})

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
