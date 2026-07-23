"""NeuroSecure demo backend — Phase 4.

Real endpoints and real SSE wire format per docs/CONTRACTS.md v2; shield
results are still canned (backend/fake_shields.py). Phase 7 swaps the fakes
for real LLM calls without changing any endpoint or event shape.

Run:  uvicorn backend.app:app --port 8000        (ONE worker — see STATE note)
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .fake_shields import CHALLENGE_PASSED_ADJUDICATION
from .orchestrator import run_evaluation


def _agent_mode() -> bool:
    """ONESHIELD_AGENT=1 routes evaluations through the portable LangGraph
    One Shield agent (oneshield_agents/). Read per request so it can be
    flipped without editing code between rehearsal runs. The legacy
    orchestrator remains the default and the fallback for interactive
    consent runs (the agent path does not carry the consent_request flow)."""
    return os.environ.get("ONESHIELD_AGENT") == "1"

ROOT = Path(__file__).resolve().parent.parent
SCENARIOS_DIR = ROOT / "scenarios"
FRONTEND_DIST = ROOT / "frontend" / "dist"

SCENARIO_NAMES = ["normal", "coerced", "bot", "workout", "no_consent"]

# DEMO-ONLY state: module-level dict, valid because we run exactly ONE uvicorn
# worker (hard rule). A real deployment would use a shared store.
STATE: dict = {"scenario": "normal"}
RUNS: dict[str, dict] = {}  # run_id -> {"queue": Queue, "response": Queue}
RUN_EOF = object()


def _load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


BASELINE = _load_json(SCENARIOS_DIR / "baseline.json")
FIXTURES = {name: _load_json(SCENARIOS_DIR / f"{name}.json") for name in SCENARIO_NAMES}

app = FastAPI(title="NeuroSecure demo backend")


# Scope isolation extends to the baseline: each shield sees ONLY the baseline
# fields in its own domain. Irrelevant fields measurably distract 8-12B models
# (observed: transaction score diluted by wearable fields; biometric citing
# "typical transaction hours").
BASELINE_VIEWS = {
    "transaction": ("typical_txn_range_usd", "typical_hours", "payments_last_24h"),
    "biometric": ("resting_hr", "sleep_window"),
    "context": ("typical_locations", "typical_hours", "sleep_window"),
    "behavior": ("typical_mouse_linearity", "typical_cadence_var_ms"),
}


def _baseline_view(shield: str) -> dict:
    return {k: BASELINE[k] for k in BASELINE_VIEWS[shield] if k in BASELINE}


def build_slices(scenario: str, payload: dict) -> dict:
    """Merge request + fixture + per-domain baseline into per-shield slices
    (scope isolation per CONTRACTS.md)."""
    fixture = FIXTURES[scenario]
    telemetry = fixture.get("telemetry_override") or payload.get("telemetry", {})
    consent = dict(payload.get("consent") or {})
    consent.update(fixture.get("consent_override") or {})
    biometrics = fixture.get("biometrics") or fixture.get("biometrics_if_granted") or {}
    return {
        "transaction": {"transaction": payload.get("transaction", {}), "baseline": _baseline_view("transaction")},
        "biometric": {"biometrics": biometrics, "baseline": _baseline_view("biometric"), "consent": consent},
        "context": {"context": fixture.get("context", {}), "baseline": _baseline_view("context")},
        "behavior": {"telemetry": telemetry, "baseline": _baseline_view("behavior")},
        "_consent": consent,
        # Optional on-device signal that reached the Sentinel before this
        # payment (e.g. a wearable alert) — routing evidence, not shield data.
        "_sentinel_hint": fixture.get("sentinel_hint"),
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "scenario": STATE["scenario"], "mode": "real-shields (Phase 7)"}


@app.get("/api/scenario")
async def get_scenario():
    return {"active": STATE["scenario"]}


@app.post("/api/scenario")
async def set_scenario(body: dict):
    name = body.get("name")
    if name not in SCENARIO_NAMES:
        raise HTTPException(status_code=422, detail=f"unknown scenario {name!r}")
    STATE["scenario"] = name
    return {"active": name}


def is_escalated(scenario: str, payload: dict) -> bool:
    """Deterministic escalation trigger per CONTRACTS.md."""
    txn = payload.get("transaction") or {}
    amount = txn.get("amount") or 0
    return (
        amount > BASELINE["typical_txn_range_usd"][1]
        or bool(txn.get("payee_first_seen"))
        or bool(FIXTURES[scenario].get("escalate"))
    )


async def _run_real(run_id: str, scenario: str, payload: dict, slices: dict,
                    escalated: bool, interactive: bool) -> None:
    """Drive a real orchestrated run onto this run's SSE queue."""
    run = RUNS[run_id]
    queue = run["queue"]
    try:
        if _agent_mode() and not interactive:
            from oneshield_agents import run_investigation
            await run_investigation(
                {k: slices[k] for k in ("transaction", "biometric", "context", "behavior")},
                payload.get("transaction", {}), slices["_consent"],
                emit=queue.put)
        else:
            await run_evaluation(
                run_id, scenario, payload, slices, escalated,
                emit=queue.put,
                response_q=run["response"] if interactive else None,
            )
    except Exception as exc:  # never leave a stream hanging
        print(f"[run {run_id}] orchestration error: {exc!r}")
    finally:
        await queue.put(RUN_EOF)


async def _run_challenge_passed(run_id: str) -> None:
    """Per CONTRACTS.md: challenge continuation returns allow (no LLM)."""
    queue = RUNS[run_id]["queue"]
    await asyncio.sleep(1.0)
    await queue.put({"type": "adjudication", **CHALLENGE_PASSED_ADJUDICATION})
    await queue.put(RUN_EOF)


@app.post("/api/evaluate")
async def evaluate(request: Request):
    payload = await request.json()
    scenario = STATE["scenario"]

    slices = build_slices(scenario, payload)
    # no_consent fixture forces the declined state regardless of the UI choice,
    # so the control panel can drive the consent beat on its own.
    effective_payload = {**payload, "consent": slices["_consent"]}
    print(f"[evaluate] scenario={scenario} consent={slices['_consent']} "
          f"txn={payload.get('transaction', {}).get('amount')}")

    consent = slices["_consent"]
    sync = request.query_params.get("sync") == "1"
    escalated = is_escalated(scenario, payload)
    is_continuation = bool(payload.get("challenge_passed") or consent.get("offer_declined")
                           or consent.get("temporary"))
    interactive = (
        consent.get("biometrics") is False
        and not is_continuation
        and escalated
        and not sync
    )

    run_id = uuid.uuid4().hex[:12]

    if payload.get("challenge_passed"):
        if sync:
            return {"run_id": "sync",
                    "results": [{"type": "adjudication", **CHALLENGE_PASSED_ADJUDICATION}]}
        RUNS[run_id] = {"queue": asyncio.Queue(), "response": asyncio.Queue(maxsize=1)}
        asyncio.create_task(_run_challenge_passed(run_id))
        return {"run_id": run_id}

    if sync:
        # Spinner-mode fallback: run everything, return events inline. Not
        # interactive — the real Adjudicator may itself offer the one-time
        # permission (legacy grant-screen route).
        events: list = []

        async def collect(evt):
            events.append(evt)

        await run_evaluation(run_id, scenario, effective_payload, slices,
                             escalated, emit=collect, response_q=None)
        return {"run_id": "sync", "results": events}

    RUNS[run_id] = {"queue": asyncio.Queue(), "response": asyncio.Queue(maxsize=1)}
    asyncio.create_task(_run_real(run_id, scenario, effective_payload, slices,
                                  escalated, interactive))
    return {"run_id": run_id}


@app.post("/api/respond")
async def respond(body: dict):
    run = RUNS.get(body.get("run_id"))
    if run is None:
        raise HTTPException(status_code=404, detail="unknown run_id")
    try:
        run["response"].put_nowait(bool(body.get("grant")))
    except asyncio.QueueFull:
        raise HTTPException(status_code=409, detail="already answered")
    return {"ok": True}


@app.get("/api/stream")
async def stream(run_id: str):
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="unknown run_id")
    queue = run["queue"]

    async def gen():
        try:
            while True:
                event = await queue.get()
                if event is RUN_EOF:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            RUNS.pop(run_id, None)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Static mount LAST so /api/* wins (hard rule).
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
