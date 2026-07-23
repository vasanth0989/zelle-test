"""Defensive JSON parsing + contract validation.

Ported from backend/llm.py (the battle-tested demo parser) so this package is
fully self-contained — it must run inside a Jupyter workspace that does not
have the NeuroSecure backend on its path.

Contracts are docs/CONTRACTS.md v2: shields return score/confidence/rationale/
steps; the adjudicator returns decision/risk_score/step_up_method/
customer_message/reasoning. Small models wrap JSON in fences and prose, so we
extract the first balanced JSON object instead of trusting json.loads.
"""
from __future__ import annotations

import json
import re

CONFIDENCES = {"low", "medium", "high"}
DECISIONS = {"allow", "step_up", "pause"}
STEP_UP_METHODS = {"questions", "temporary_biometric_permission", None}

RETRY_NUDGE = (
    "Your previous reply was not a single valid JSON object. "
    "Return ONLY the JSON object — no markdown, no code fences, no other text."
)

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def extract_json(text: str) -> dict:
    """Pull the first JSON object out of model output, tolerating fences and
    surrounding prose. Raises ValueError if nothing parseable is found."""
    candidates = _FENCE_RE.findall(text)
    candidates.append(text)
    for candidate in candidates:
        start = candidate.find("{")
        if start == -1:
            continue
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(candidate)):
            ch = candidate[i]
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
            elif ch == '"':
                in_string = not in_string
            elif not in_string:
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            obj = json.loads(candidate[start : i + 1])
                        except json.JSONDecodeError:
                            break
                        if isinstance(obj, dict):
                            return obj
                        break
    raise ValueError("no valid JSON object in model output")


def _int_score(value, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field} is not a number")
    score = int(round(value))
    if not 0 <= score <= 100:
        raise ValueError(f"{field} out of range: {score}")
    return score


def _text(value, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} missing or empty")
    return value.strip()


def validate_shield(obj: dict) -> dict:
    confidence = str(obj.get("confidence", "")).lower()
    if confidence not in CONFIDENCES:
        raise ValueError(f"bad confidence: {obj.get('confidence')!r}")
    steps = obj.get("steps", [])
    if not isinstance(steps, list):
        raise ValueError("steps is not a list")
    return {
        "score": _int_score(obj.get("score"), "score"),
        "confidence": confidence,
        "rationale": _text(obj.get("rationale"), "rationale"),
        "steps": [str(s).strip() for s in steps if str(s).strip()][:6],
    }


def validate_adjudicator(obj: dict) -> dict:
    decision = str(obj.get("decision", "")).lower()
    if decision not in DECISIONS:
        raise ValueError(f"bad decision: {obj.get('decision')!r}")
    method = obj.get("step_up_method")
    if isinstance(method, str):
        method = method.lower() or None
    if method not in STEP_UP_METHODS:
        raise ValueError(f"bad step_up_method: {obj.get('step_up_method')!r}")
    if decision != "step_up":
        method = None
    elif method is None:
        method = "questions"  # protective default for a step_up with no method
    message = obj.get("customer_message", "")
    if not isinstance(message, str):
        raise ValueError("customer_message is not a string")
    return {
        "decision": decision,
        "risk_score": _int_score(obj.get("risk_score"), "risk_score"),
        "step_up_method": method,
        "customer_message": message.strip(),
        "reasoning": _text(obj.get("reasoning"), "reasoning"),
    }


# ---------- neutral fallbacks (honest, never invented) ----------

SHIELD_FALLBACK = {
    "score": 50,
    "confidence": "low",
    "rationale": "Signal unavailable — the evaluation service did not return a valid result.",
    "steps": ["Fallback: neutral result"],
    "_fallback": True,
}

ADJUDICATOR_FALLBACK = {
    "decision": "step_up",
    "risk_score": 50,
    "step_up_method": "questions",
    "customer_message": (
        "We just need a quick moment to double-check this payment. "
        "Is someone asking or instructing you to make it right now?"
    ),
    "reasoning": "Fallback: adjudication unavailable; protective step-up chosen over blocking or waving through.",
    "_fallback": True,
}
