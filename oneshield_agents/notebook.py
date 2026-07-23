"""Standalone runners — run One Shield without the NeuroSecure backend.

This is the Jupyter entry point. It bundles what backend/app.py normally
does (merge fixture + baseline into per-shield slices) using the fixtures
copied into config/fixtures/, plus a representative "what the phone would
send" payload per scenario.

Usage in a notebook cell (Capital One sandbox):
    import os
    os.environ["ONESHIELD_LLM_PROVIDER"] = "c1"   # llama-4-scout via sandbox
    from oneshield_agents.notebook import run_scenario
    record = run_scenario("coerced")               # grandparent scam story

Locally (Ollama running):
    from oneshield_agents.notebook import run_scenario
    record = run_scenario("coerced")               # provider defaults local
"""
from __future__ import annotations

import asyncio

from .agent import run_investigation
from .config_loader import load_fixture

# Scope isolation (CLAUDE.md canonical table): each shield sees ONLY the
# baseline fields in its own domain — irrelevant fields measurably distract
# 8-12B models.
BASELINE_VIEWS = {
    "transaction": ("typical_txn_range_usd", "typical_hours", "payments_last_24h"),
    "biometric": ("resting_hr", "sleep_window"),
    "context": ("typical_locations", "typical_hours", "sleep_window"),
    "behavior": ("typical_mouse_linearity", "typical_cadence_var_ms"),
}

# What the banking UI would POST for each demo story (frontend/src/
# demoScenarios.js is the source of truth for amounts and payees).
DEFAULT_PAYLOADS = {
    "coerced": {
        "transaction": {"amount": 2000, "payee": "michael.easter@zellemail.com",
                        "payee_first_seen": True, "channel": "zelle", "memo": None},
        "telemetry": {"mouse_path_linearity": 0.38, "typing_cadence_var_ms": 95,
                      "hesitation_before_send_ms": 6100, "field_fill": "typed"},
        "consent": {"biometrics": True},
    },
    "bot": {
        "transaction": {"amount": 5200, "payee": "michael.easter@zellemail.com",
                        "payee_first_seen": True, "channel": "zelle", "memo": None},
        "telemetry": {"mouse_path_linearity": 0.97, "typing_cadence_var_ms": 3,
                      "hesitation_before_send_ms": 120, "field_fill": "paste_all"},
        "consent": {"biometrics": True},
    },
    "workout": {
        "transaction": {"amount": 120, "payee": "rich.fairbank@zellemail.com",
                        "payee_first_seen": False, "channel": "zelle", "memo": None},
        "telemetry": {"mouse_path_linearity": 0.44, "typing_cadence_var_ms": 90,
                      "hesitation_before_send_ms": 900, "field_fill": "typed"},
        "consent": {"biometrics": True},
    },
    "normal": {
        "transaction": {"amount": 60, "payee": "rich.fairbank@zellemail.com",
                        "payee_first_seen": False, "channel": "zelle", "memo": None},
        "telemetry": {"mouse_path_linearity": 0.41, "typing_cadence_var_ms": 82,
                      "hesitation_before_send_ms": 1100, "field_fill": "typed"},
        "consent": {"biometrics": True},
    },
}


def build_slices(scenario: str, payload: dict) -> dict:
    """Merge request + fixture + per-domain baseline into per-shield slices —
    the same merge backend/app.py performs for the live UI."""
    baseline = load_fixture("baseline")
    fixture = load_fixture(scenario)
    telemetry = fixture.get("telemetry_override") or payload.get("telemetry", {})
    biometrics = fixture.get("biometrics") or fixture.get("biometrics_if_granted") or {}

    def view(shield: str) -> dict:
        return {k: baseline[k] for k in BASELINE_VIEWS[shield] if k in baseline}

    return {
        "transaction": {"transaction": payload.get("transaction", {}), "baseline": view("transaction")},
        "biometric": {"biometrics": biometrics, "baseline": view("biometric")},
        "context": {"context": fixture.get("context", {}), "baseline": view("context")},
        "behavior": {"telemetry": telemetry, "baseline": view("behavior")},
    }


async def arun_scenario(scenario: str = "coerced", payload: dict | None = None,
                        emit=None) -> dict:
    """Async runner: return {"results", "adjudication"}. Events stream to the
    console via the package's central logging (console.py, ONESHIELD_LOG);
    pass `emit` only when a program needs the raw event dicts too."""
    payload = payload or DEFAULT_PAYLOADS[scenario]
    slices = build_slices(scenario, payload)
    return await run_investigation(slices, payload.get("transaction", {}),
                                   payload.get("consent", {"biometrics": True}),
                                   emit)


def run_scenario(scenario: str = "coerced", payload: dict | None = None) -> dict:
    """Sync wrapper safe in scripts AND notebooks. Jupyter already runs an
    event loop, so plain asyncio.run() fails there — the reference
    workspace's fresh-loop pattern handles both."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(arun_scenario(scenario, payload))
    # Inside Jupyter: run on a private loop in a worker thread.
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, arun_scenario(scenario, payload)).result()
