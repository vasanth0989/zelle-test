"""Phase 5/6 selftest: REAL shield calls against the configured LLM(s).

Run:  .venv\\Scripts\\python -m backend.selftest

Heterogeneous strategy: runs the Transaction Shield on the default model
(Llama family locally) AND the Biometric Shield on its override model (Gemma
family), each against a coerced-scenario slice, printing validated contract
JSON. Exits 1 with a clear message if the LLM endpoint is unreachable or any
call falls back.
"""
import asyncio
import json
import sys
from pathlib import Path

import httpx

from .llm import LLM_BASE_URL, SHIELD_FALLBACK, call_agent, resolve_model, validate_shield
from .prompts import PROMPTS

ROOT = Path(__file__).resolve().parent.parent


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    baseline = load_json(ROOT / "scenarios" / "baseline.json")
    coerced = load_json(ROOT / "scenarios" / "coerced.json")

    checks = [
        ("transaction", {
            "transaction": {"amount": 450, "payee": "QuickFix Support",
                            "payee_first_seen": True, "channel": "zelle", "memo": None,
                            "local_time": coerced["context"]["local_time"]},
            "baseline": baseline,
        }),
        ("biometric", {"biometrics": coerced["biometrics"], "baseline": baseline}),
    ]

    print(f"LLM_BASE_URL = {LLM_BASE_URL}")
    try:
        httpx.get(f"{LLM_BASE_URL}/models", timeout=5)
    except httpx.HTTPError as exc:
        print(f"\nLLM endpoint unreachable: {exc}")
        print("Start Ollama, pull the models in .env.example, then re-run.")
        return 1

    failures = 0
    for shield, payload in checks:
        model = resolve_model(shield)
        print(f"\n=== {shield} shield → {model} (coerced slice) ===")
        result = asyncio.run(call_agent(
            PROMPTS[shield], payload, validate_shield, SHIELD_FALLBACK, shield=shield,
        ))
        print(json.dumps(result, indent=2))
        if result.get("_fallback"):
            failures += 1
            print(f"FALLBACK — {shield} did not produce valid contract JSON.")

    if failures:
        print(f"\nSelftest FAILED for {failures} shield(s).")
        return 1
    print("\nSelftest OK — valid contract JSON from both models.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
