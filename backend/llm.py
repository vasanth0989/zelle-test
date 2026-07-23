"""LLM client + defensive parser (CLAUDE.md rule 4/5).

- Provider via env: LLM_BASE_URL / LLM_MODEL / LLM_API_KEY. Temperature 0.
- Defensive parse: strip fences, extract the JSON object from surrounding
  prose, validate against the per-agent contract.
- One retry on malformed output (with a return-only-JSON nudge).
- 15s timeout per call; network/timeout failure or two bad parses → neutral
  fallback, flagged with "_fallback": True so callers can log honestly.
"""
from __future__ import annotations

import asyncio
import json
import os
import re

import httpx

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
DEFAULT_MODEL = "gemma3:12b"  # per CLAUDE.md rule 5; local rehearsal overrides via env
TIMEOUT_S = 15


def request_profile() -> str:
    """Sampling-parameter dialect. 'ollama' (default): temperature 0 is valid
    greedy decoding. 'c1-vllm' (EMP Foundation Model Gateway): temperature 0
    is an ERROR per the catalog — greedy is expressed as do_sample=false (its
    default), and max_new_tokens MUST be sent (gateway default of 20 would
    truncate every JSON response). Same deterministic intent, two dialects."""
    return os.environ.get("LLM_REQUEST_PROFILE", "ollama")


def build_request_body(model: str, system: str, user: str) -> dict:
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if request_profile() == "c1-vllm":
        body["do_sample"] = False  # greedy — the gateway's temperature-0
        body["max_new_tokens"] = int(os.environ.get("LLM_MAX_NEW_TOKENS", "512"))
    else:
        body["temperature"] = 0
    return body


def resolve_model(shield_key: str | None = None) -> str:
    """Heterogeneous model strategy: LLM_MODEL_<SHIELD> (e.g.
    LLM_MODEL_BIOMETRIC) overrides LLM_MODEL for that shield only. Read at
    call time so tests and demo-day switches don't fight import order."""
    if shield_key:
        specific = os.environ.get(f"LLM_MODEL_{shield_key.upper()}")
        if specific:
            return specific
    return os.environ.get("LLM_MODEL", DEFAULT_MODEL)

RETRY_NUDGE = (
    "Your previous reply was not a single valid JSON object. "
    "Return ONLY the JSON object — no markdown, no code fences, no other text."
)


class LLMError(Exception):
    """Transport-level failure: unreachable, HTTP error, or timeout."""


async def chat(system: str, user: str, timeout: float = TIMEOUT_S, model: str | None = None) -> str:
    """One deterministic (greedy) call. This is the single transport function
    — any Gateway deviation gets adapted HERE and nowhere else.

    Transports (env LLM_TRANSPORT):
    - "http" (default): OpenAI-compatible POST /chat/completions via httpx.
    - "c1-sdk": the EMP-internal c1.aiml.genai.inference Client (preinstalled
      in EMP notebooks; carries workspace auth). Use if raw HTTP is rejected.
    """
    resolved = model or resolve_model()
    if os.environ.get("LLM_TRANSPORT", "http") == "c1-sdk":
        return await _chat_via_c1_sdk(system, user, resolved)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json=build_request_body(resolved, system, user),
            )
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMError(str(exc)) from exc


async def _chat_via_c1_sdk(system: str, user: str, model: str) -> str:
    """EMP-internal SDK transport. Import is lazy: the package exists only in
    EMP notebooks. The SDK is sync, so it runs in a worker thread."""
    try:
        from c1.aiml.genai.inference import Client  # type: ignore
    except ImportError as exc:
        raise LLMError(
            "LLM_TRANSPORT=c1-sdk but c1.aiml.genai.inference is not installed "
            "(it exists only inside EMP notebooks)") from exc

    def _call() -> str:
        client = Client()
        kwargs: dict = {}
        if request_profile() == "c1-vllm":
            kwargs["do_sample"] = False
            kwargs["max_new_tokens"] = int(os.environ.get("LLM_MAX_NEW_TOKENS", "512"))
        else:
            kwargs["temperature"] = 0
        response = client.chat.completions.create(
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user}],
            model=model, **kwargs)
        return response.choices[0].message.content

    try:
        return await asyncio.wait_for(asyncio.to_thread(_call), timeout=TIMEOUT_S)
    except Exception as exc:  # SDK exception types are unknown outside EMP
        raise LLMError(f"c1-sdk call failed: {exc}") from exc


# ---------- parsing ----------

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
            elif ch == '"' and not escape:
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


# ---------- validation (contract shapes, docs/CONTRACTS.md v2) ----------

CONFIDENCES = {"low", "medium", "high"}
DECISIONS = {"allow", "step_up", "pause"}
STEP_UP_METHODS = {"questions", "temporary_biometric_permission", None}
SHIELD_KEYS = {"transaction", "biometric", "context", "behavior"}


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


def validate_sentinel(obj: dict) -> dict:
    """Sentinel routing decision (docs/CONTRACTS.md v2.2). Subset-filtering
    against remaining_shields happens in the orchestrator — here we only
    guarantee shape and known shield names."""
    thinking = obj.get("thinking", [])
    if not isinstance(thinking, list):
        raise ValueError("thinking is not a list")
    thinking = [str(t).strip() for t in thinking if str(t).strip()][:4]
    if not thinking:
        raise ValueError("thinking is empty")
    invoke = obj.get("invoke", [])
    if not isinstance(invoke, list):
        raise ValueError("invoke is not a list")
    invoke = [str(s).strip().lower() for s in invoke if str(s).strip()]
    unknown = [s for s in invoke if s not in SHIELD_KEYS]
    if unknown:
        raise ValueError(f"unknown shields in invoke: {unknown}")
    conclude = bool(obj.get("conclude", False))
    if not invoke:
        conclude = True  # nothing to invoke = the investigation is done
    skip_note = obj.get("skip_note", "")
    if not isinstance(skip_note, str):
        skip_note = ""
    return {"thinking": thinking, "invoke": invoke,
            "conclude": conclude, "skip_note": skip_note.strip()}


def validate_staged_initial(obj: dict) -> dict:
    need_more = obj.get("need_more")
    if not isinstance(need_more, bool):
        raise ValueError("need_more is not a bool")
    return {
        "preliminary_score": _int_score(obj.get("preliminary_score"), "preliminary_score"),
        "need_more": need_more,
        "step": _text(obj.get("step"), "step"),
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

STAGED_FALLBACK = {
    "preliminary_score": 50,
    "need_more": True,
    "step": "Fallback: initial read unavailable — requesting full data.",
    "_fallback": True,
}

# Sentinel routing failure degrades to today's accepted behavior: the
# orchestrator invokes every remaining shield in parallel, skips nothing.
SENTINEL_FALLBACK = {
    "thinking": ["Routing unavailable — running every remaining check in parallel."],
    "invoke": [],
    "conclude": False,
    "skip_note": "",
    "_fallback": True,
}


# ---------- orchestrated call: parse → retry once → fallback ----------

async def call_agent(system: str, payload: dict, validator, fallback: dict, *,
                     chat_fn=None, shield: str | None = None) -> dict:
    """One agent call with the full defensive path. `shield` selects the model
    via resolve_model(); chat_fn is injectable for tests. Transport failures
    (incl. timeout) go straight to fallback — retrying a 15s timeout would
    blow the demo's latency budget."""
    model = resolve_model(shield)

    async def default_chat(system_msg, user_msg):
        return await chat(system_msg, user_msg, model=model)

    do_chat = chat_fn or default_chat
    user = json.dumps(payload)
    try:
        text = await do_chat(system, user)
    except LLMError:
        return dict(fallback)
    for attempt in (1, 2):
        try:
            return validator(extract_json(text))
        except ValueError:
            if attempt == 2:
                return dict(fallback)
        try:
            text = await do_chat(system, f"{user}\n\n{RETRY_NUDGE}")
        except LLMError:
            return dict(fallback)
    return dict(fallback)  # unreachable, defensive
