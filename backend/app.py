"""NeuroSecure backend — cof shippable edition.

ONE evaluation path: every run goes through the One Shield LangGraph agent
(oneshield_agents/), which calls the sandbox LLM client. No URLs, no keys.

Endpoints (docs/CONTRACTS.md v2.2 + tone/insight step fields):
  POST api/evaluate  -> {"run_id"}     (?sync=1 -> inline results)
  GET  api/stream    -> SSE events     (sentinel/invoke/step/result/adjudication)
  GET/POST api/scenario, GET api/health
  static mount LAST so /api/* wins.

Run:  uvicorn backend.app:app --host 0.0.0.0 --port 8000   (ONE worker)
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from oneshield_agents import run_investigation

ROOT = Path(__file__).resolve().parent.parent
SCENARIOS_DIR = ROOT / "scenarios"
FRONTEND_DIST = ROOT / "frontend" / "dist"

SCENARIO_NAMES = ["normal", "coerced", "bot", "workout", "no_consent"]

# DEMO-ONLY state: module-level dict, valid because we run exactly ONE uvicorn
# worker (hard rule). A real deployment would use a shared store.
STATE: dict = {"scenario": "normal"}
RUNS: dict[str, dict] = {}  # run_id -> {"queue": Queue}
RUN_EOF = object()

# Step-up continuation: the customer answered the scam-interruption questions.
# Deterministic by contract (no LLM) — the challenge itself was the safeguard.
CHALLENGE_PASSED_ADJUDICATION = {
    "decision": "allow", "risk_score": 24, "step_up_method": None,
    "customer_message": "",
    "reasoning": "Customer confirmed the payment context under a step-up challenge.",
}


def _load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


BASELINE = _load_json(SCENARIOS_DIR / "baseline.json")
FIXTURES = {name: _load_json(SCENARIOS_DIR / f"{name}.json") for name in SCENARIO_NAMES}

app = FastAPI(title="NeuroSecure backend (cof)")


# Scope isolation extends to the baseline: each shield sees ONLY the baseline
# fields in its own domain (irrelevant fields measurably distract 8-12B models).
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
        "biometric": {"biometrics": biometrics, "baseline": _baseline_view("biometric")},
        "context": {"context": fixture.get("context", {}), "baseline": _baseline_view("context")},
        "behavior": {"telemetry": telemetry, "baseline": _baseline_view("behavior")},
        "_consent": consent,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "scenario": STATE["scenario"], "mode": "one-shield-agent"}


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


def _agent_slices(slices: dict) -> dict:
    return {k: slices[k] for k in ("transaction", "biometric", "context", "behavior")}


async def _run_agent(run_id: str, payload: dict, slices: dict) -> None:
    """Drive a One Shield agent run onto this run's SSE queue."""
    queue = RUNS[run_id]["queue"]
    try:
        await run_investigation(_agent_slices(slices),
                                payload.get("transaction", {}),
                                slices["_consent"], emit=queue.put)
    except Exception as exc:  # never leave a stream hanging
        print(f"[run {run_id}] orchestration error: {exc!r}")
    finally:
        await queue.put(RUN_EOF)


async def _run_challenge_passed(run_id: str) -> None:
    queue = RUNS[run_id]["queue"]
    await asyncio.sleep(1.0)
    await queue.put({"type": "adjudication", **CHALLENGE_PASSED_ADJUDICATION})
    await queue.put(RUN_EOF)


@app.post("/api/evaluate")
async def evaluate(request: Request):
    payload = await request.json()
    scenario = STATE["scenario"]
    slices = build_slices(scenario, payload)
    print(f"[evaluate] scenario={scenario} "
          f"txn={payload.get('transaction', {}).get('amount')}")

    run_id = uuid.uuid4().hex[:12]
    sync = request.query_params.get("sync") == "1"

    if payload.get("challenge_passed"):
        if sync:
            return {"run_id": "sync",
                    "results": [{"type": "adjudication", **CHALLENGE_PASSED_ADJUDICATION}]}
        RUNS[run_id] = {"queue": asyncio.Queue()}
        asyncio.create_task(_run_challenge_passed(run_id))
        return {"run_id": run_id}

    if sync:
        # Spinner-mode fallback: run everything, return events inline.
        events: list = []

        async def collect(evt):
            events.append(evt)

        await run_investigation(_agent_slices(slices),
                                payload.get("transaction", {}),
                                slices["_consent"], emit=collect)
        return {"run_id": "sync", "results": events}

    RUNS[run_id] = {"queue": asyncio.Queue()}
    asyncio.create_task(_run_agent(run_id, payload, slices))
    return {"run_id": run_id}


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
