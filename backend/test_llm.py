"""Parser + retry/fallback unit tests (Phase 5 acceptance). Offline — no model.

Run:  .venv\\Scripts\\python -m pytest backend\\test_llm.py -q
"""
import asyncio

import pytest

from .llm import (
    ADJUDICATOR_FALLBACK,
    DEFAULT_MODEL,
    SHIELD_FALLBACK,
    LLMError,
    build_request_body,
    call_agent,
    extract_json,
    resolve_model,
    validate_adjudicator,
    validate_sentinel,
    validate_shield,
    validate_staged_initial,
)

GOOD_SHIELD = '{"score": 81, "confidence": "high", "rationale": "Elevated.", "steps": ["a", "b"]}'


# ---------- extract_json ----------

def test_extract_plain_json():
    assert extract_json(GOOD_SHIELD)["score"] == 81


def test_extract_fenced_json():
    assert extract_json(f"```json\n{GOOD_SHIELD}\n```")["score"] == 81


def test_extract_fenced_no_lang():
    assert extract_json(f"```\n{GOOD_SHIELD}\n```")["score"] == 81


def test_extract_json_buried_in_prose():
    text = f"Sure! Here is my assessment:\n{GOOD_SHIELD}\nLet me know if you need more."
    assert extract_json(text)["confidence"] == "high"


def test_extract_nested_braces_and_strings():
    tricky = '{"rationale": "uses {braces} and \\"quotes\\"", "score": 10, "confidence": "low"}'
    assert extract_json(tricky)["score"] == 10


def test_extract_truncated_json_raises():
    with pytest.raises(ValueError):
        extract_json('{"score": 81, "confidence": "hi')


def test_extract_no_json_raises():
    with pytest.raises(ValueError):
        extract_json("I cannot answer that.")


# ---------- shield validation ----------

def test_shield_valid_normalizes():
    out = validate_shield({"score": 81.4, "confidence": "HIGH", "rationale": " x ", "steps": ["s1", ""]})
    assert out == {"score": 81, "confidence": "high", "rationale": "x", "steps": ["s1"]}


def test_shield_missing_steps_defaults_empty():
    assert validate_shield({"score": 5, "confidence": "low", "rationale": "r"})["steps"] == []


@pytest.mark.parametrize("score", [-1, 101, 150, "eighty", None, True])
def test_shield_bad_score_rejected(score):
    with pytest.raises(ValueError):
        validate_shield({"score": score, "confidence": "low", "rationale": "r"})


def test_shield_bad_confidence_rejected():
    with pytest.raises(ValueError):
        validate_shield({"score": 10, "confidence": "certain", "rationale": "r"})


def test_shield_empty_rationale_rejected():
    with pytest.raises(ValueError):
        validate_shield({"score": 10, "confidence": "low", "rationale": "  "})


# ---------- adjudicator validation ----------

def test_adjudicator_valid():
    out = validate_adjudicator({
        "decision": "step_up", "risk_score": 82,
        "step_up_method": "questions", "customer_message": "m", "reasoning": "r",
    })
    assert out["decision"] == "step_up" and out["step_up_method"] == "questions"


def test_adjudicator_method_nulled_when_not_step_up():
    out = validate_adjudicator({
        "decision": "allow", "risk_score": 10,
        "step_up_method": "questions", "customer_message": "", "reasoning": "r",
    })
    assert out["step_up_method"] is None


def test_adjudicator_step_up_missing_method_defaults_questions():
    out = validate_adjudicator({
        "decision": "step_up", "risk_score": 60, "customer_message": "m", "reasoning": "r",
    })
    assert out["step_up_method"] == "questions"


def test_adjudicator_bad_decision_rejected():
    with pytest.raises(ValueError):
        validate_adjudicator({"decision": "deny", "risk_score": 60, "reasoning": "r"})


def test_adjudicator_bad_method_rejected():
    with pytest.raises(ValueError):
        validate_adjudicator({
            "decision": "step_up", "risk_score": 60,
            "step_up_method": "otp", "customer_message": "m", "reasoning": "r",
        })


# ---------- staged initial validation ----------

def test_staged_valid():
    out = validate_staged_initial({"preliminary_score": 70, "need_more": True, "step": "s"})
    assert out["need_more"] is True


def test_staged_need_more_must_be_bool():
    with pytest.raises(ValueError):
        validate_staged_initial({"preliminary_score": 70, "need_more": "yes", "step": "s"})


# ---------- sentinel routing validation (v2.2) ----------

def test_sentinel_valid_invoke():
    out = validate_sentinel({"thinking": ["big amount, new payee"],
                             "invoke": ["context", "transaction"], "conclude": False})
    assert out["invoke"] == ["context", "transaction"]
    assert out["conclude"] is False


def test_sentinel_empty_invoke_becomes_conclude():
    out = validate_sentinel({"thinking": ["all clear"], "invoke": [],
                             "conclude": False, "skip_note": "signals are low"})
    assert out["conclude"] is True
    assert out["skip_note"] == "signals are low"


def test_sentinel_unknown_shield_raises():
    with pytest.raises(ValueError):
        validate_sentinel({"thinking": ["x"], "invoke": ["geolocation"]})


def test_sentinel_empty_thinking_raises():
    with pytest.raises(ValueError):
        validate_sentinel({"thinking": [], "invoke": ["context"]})


def test_sentinel_normalizes_case_and_whitespace():
    out = validate_sentinel({"thinking": [" check location "], "invoke": [" Context "]})
    assert out["invoke"] == ["context"]
    assert out["thinking"] == ["check location"]


# ---------- per-shield model resolution ----------

def test_resolve_model_shield_override(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "llama3.1:8b")
    monkeypatch.setenv("LLM_MODEL_BIOMETRIC", "gemma3:12b")
    assert resolve_model("biometric") == "gemma3:12b"
    assert resolve_model("transaction") == "llama3.1:8b"
    assert resolve_model("adjudicator") == "llama3.1:8b"


def test_resolve_model_falls_back_to_default(monkeypatch):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("LLM_MODEL_BIOMETRIC", raising=False)
    assert resolve_model("biometric") == DEFAULT_MODEL
    assert resolve_model() == DEFAULT_MODEL


def test_resolve_model_no_shield_ignores_shield_overrides(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "llama3.1:8b")
    monkeypatch.setenv("LLM_MODEL_BIOMETRIC", "gemma3:12b")
    assert resolve_model() == "llama3.1:8b"


# ---------- request profiles (Ollama vs EMP c1-vllm dialect) ----------

def test_body_ollama_profile_uses_temperature_zero(monkeypatch):
    monkeypatch.delenv("LLM_REQUEST_PROFILE", raising=False)
    body = build_request_body("llama3.1:8b", "sys", "usr")
    assert body["temperature"] == 0
    assert "do_sample" not in body and "max_new_tokens" not in body


def test_body_c1_vllm_profile_omits_temperature(monkeypatch):
    monkeypatch.setenv("LLM_REQUEST_PROFILE", "c1-vllm")
    body = build_request_body("llama-3.3-70b", "sys", "usr")
    assert "temperature" not in body  # temperature: 0 is an ERROR on the gateway
    assert body["do_sample"] is False  # greedy = deterministic intent preserved
    assert body["max_new_tokens"] == 512  # gateway default of 20 would truncate JSON


def test_body_c1_vllm_max_new_tokens_override(monkeypatch):
    monkeypatch.setenv("LLM_REQUEST_PROFILE", "c1-vllm")
    monkeypatch.setenv("LLM_MAX_NEW_TOKENS", "800")
    assert build_request_body("m", "s", "u")["max_new_tokens"] == 800


def test_body_messages_shape(monkeypatch):
    monkeypatch.delenv("LLM_REQUEST_PROFILE", raising=False)
    body = build_request_body("m", "SYS", "USR")
    assert body["messages"] == [
        {"role": "system", "content": "SYS"},
        {"role": "user", "content": "USR"},
    ]


# ---------- call_agent: retry + fallback paths ----------

def _run(coro):
    return asyncio.run(coro)


def test_call_agent_happy_path():
    async def fake_chat(system, user):
        return GOOD_SHIELD
    out = _run(call_agent("sys", {}, validate_shield, SHIELD_FALLBACK, chat_fn=fake_chat))
    assert out["score"] == 81 and "_fallback" not in out


def test_call_agent_retry_recovers():
    calls = []
    async def fake_chat(system, user):
        calls.append(user)
        return "garbage, not json" if len(calls) == 1 else GOOD_SHIELD
    out = _run(call_agent("sys", {}, validate_shield, SHIELD_FALLBACK, chat_fn=fake_chat))
    assert out["score"] == 81
    assert len(calls) == 2 and "ONLY the JSON" in calls[1]


def test_call_agent_two_bad_parses_falls_back():
    async def fake_chat(system, user):
        return "still not json"
    out = _run(call_agent("sys", {}, validate_shield, SHIELD_FALLBACK, chat_fn=fake_chat))
    assert out["_fallback"] is True and out["score"] == 50


def test_call_agent_out_of_range_then_valid():
    calls = []
    async def fake_chat(system, user):
        calls.append(user)
        return '{"score": 140, "confidence": "high", "rationale": "r"}' if len(calls) == 1 else GOOD_SHIELD
    out = _run(call_agent("sys", {}, validate_shield, SHIELD_FALLBACK, chat_fn=fake_chat))
    assert out["score"] == 81


def test_call_agent_transport_error_falls_back():
    async def fake_chat(system, user):
        raise LLMError("connection refused")
    out = _run(call_agent("sys", {}, validate_adjudicator, ADJUDICATOR_FALLBACK, chat_fn=fake_chat))
    assert out["_fallback"] is True and out["decision"] == "step_up"


def test_call_agent_error_on_retry_falls_back():
    calls = []
    async def fake_chat(system, user):
        calls.append(user)
        if len(calls) == 1:
            return "not json"
        raise LLMError("timed out")
    out = _run(call_agent("sys", {}, validate_shield, SHIELD_FALLBACK, chat_fn=fake_chat))
    assert out["_fallback"] is True
