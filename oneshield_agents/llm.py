"""LLM plumbing — cof edition: the sandbox client ONLY.

Every model call goes through the Capital One sandbox inference client,
exactly as the reference Jupyter workspace uses it:

    from c1.genai.integrations.langchain.inference import create_chat_openai_model
    model = create_chat_openai_model(model="llama-4-scout")

No base_url. No api_key. No URLs anywhere — the sandbox owns routing.
The client is sync-only, so every call runs in a worker thread (the
reference workspace's executor pattern).
"""
from __future__ import annotations

import asyncio
import json
import os

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from .console import log
from .parsing import RETRY_NUDGE, extract_json

DEFAULT_MODEL = "llama-4-scout"
TIMEOUT_S = float(os.environ.get("ONESHIELD_LLM_TIMEOUT", "60"))


def resolve_model(role: str | None = None) -> str:
    """Heterogeneous model strategy: LLM_MODEL_<ROLE> overrides LLM_MODEL
    for that role only (e.g. LLM_MODEL_BIOMETRIC)."""
    if role:
        specific = os.environ.get(f"LLM_MODEL_{role.upper()}")
        if specific:
            return specific
    return os.environ.get("LLM_MODEL", DEFAULT_MODEL)


def make_chat_model(role: str | None = None, *, tools: list | None = None):
    """Build the sandbox chat model for a role, optionally with tools bound."""
    try:
        from c1.genai.integrations.langchain.inference import create_chat_openai_model
    except ImportError as exc:
        raise RuntimeError(
            "The c1 sandbox package is not importable from THIS python. "
            "Launch the server from a NOTEBOOK cell so it uses the kernel's "
            "python (runBook.md §1) — the c1 package usually lives only "
            "there. Check inside a notebook: import c1; print(c1.__file__)"
        ) from exc
    model = create_chat_openai_model(model=resolve_model(role))
    if tools:
        model = model.bind_tools(tools)
    return model


async def ainvoke(model, messages: list[BaseMessage]) -> AIMessage:
    """One model call off the event loop (the sandbox client is sync-only)."""
    return await asyncio.wait_for(
        asyncio.to_thread(model.invoke, messages), timeout=TIMEOUT_S)


async def call_json_agent(role: str, system: str, payload: dict,
                          validator, fallback: dict) -> dict:
    """One JSON-contract agent call with the full defensive path: chat →
    parse → one retry with a nudge → honest fallback (marked
    "_fallback": True so callers can log it truthfully)."""
    model = make_chat_model(role)
    user = json.dumps(payload)

    async def attempt(user_msg: str) -> str:
        response = await ainvoke(model, [SystemMessage(content=system),
                                         HumanMessage(content=user_msg)])
        return response.content if isinstance(response.content, str) else str(response.content)

    try:
        text = await attempt(user)
    except Exception as exc:
        log(f"[{role:>11}] WARNING transport failed ({exc.__class__.__name__}) - neutral fallback")
        return dict(fallback)
    for round_no in (1, 2):
        try:
            return validator(extract_json(text))
        except ValueError:
            if round_no == 2:
                log(f"[{role:>11}] WARNING invalid JSON twice - neutral fallback")
                return dict(fallback)
        log(f"[{role:>11}] retry: invalid JSON, nudging once")
        try:
            text = await attempt(f"{user}\n\n{RETRY_NUDGE}")
        except Exception as exc:
            log(f"[{role:>11}] WARNING transport failed on retry ({exc.__class__.__name__}) - neutral fallback")
            return dict(fallback)
    return dict(fallback)  # unreachable, defensive
