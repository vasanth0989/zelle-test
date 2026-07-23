"""LLM plumbing — the ONLY file that knows which environment we are in.

Two providers, selected by env ONESHIELD_LLM_PROVIDER:
- "local" (default): LangChain ChatOpenAI against any OpenAI-compatible
  endpoint. Defaults target Ollama on localhost — the NeuroSecure demo rig.
- "c1": the Capital One sandbox inference client, exactly as the reference
  Jupyter workspace uses it (create_chat_openai_model, model llama-4-scout;
  base_url / api_key are owned by the sandbox — never set them there).

Every model call goes through achat()/achat_tools(), which run the model in a
worker thread: the c1 client is sync-only, and one code path for both
providers beats two (this mirrors the reference workspace's executor pattern).
"""
from __future__ import annotations

import asyncio
import json
import os

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from .console import log
from .parsing import RETRY_NUDGE, extract_json

DEFAULT_LOCAL_MODEL = "llama3.1:8b"
DEFAULT_C1_MODEL = "llama-4-scout"
TIMEOUT_S = float(os.environ.get("ONESHIELD_LLM_TIMEOUT", "60"))


def provider() -> str:
    return os.environ.get("ONESHIELD_LLM_PROVIDER", "local")


def resolve_model(role: str | None = None) -> str:
    """Heterogeneous model strategy, same env convention as backend/llm.py:
    LLM_MODEL_<ROLE> overrides LLM_MODEL for that role only."""
    if role:
        specific = os.environ.get(f"LLM_MODEL_{role.upper()}")
        if specific:
            return specific
    default = DEFAULT_C1_MODEL if provider() == "c1" else DEFAULT_LOCAL_MODEL
    return os.environ.get("LLM_MODEL", default)


def make_chat_model(role: str | None = None, *, tools: list | None = None):
    """Build the chat model for a role, optionally with tools bound."""
    if provider() == "c1":
        # Lazy import: this package exists only inside the sandbox notebooks.
        from c1.genai.integrations.langchain.inference import create_chat_openai_model
        model = create_chat_openai_model(model=resolve_model(role))
    else:
        from langchain_openai import ChatOpenAI
        model = ChatOpenAI(
            base_url=os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1"),
            api_key=os.environ.get("LLM_API_KEY", "ollama"),
            model=resolve_model(role),
            temperature=0,
            timeout=TIMEOUT_S,
        )
    if tools:
        model = model.bind_tools(tools)
    return model


async def ainvoke(model, messages: list[BaseMessage]) -> AIMessage:
    """One model call off the event loop (c1 client is sync-only)."""
    return await asyncio.wait_for(
        asyncio.to_thread(model.invoke, messages), timeout=TIMEOUT_S)


async def call_json_agent(role: str, system: str, payload: dict,
                          validator, fallback: dict) -> dict:
    """One JSON-contract agent call with the full defensive path from the
    demo backend: chat → parse → one retry with a nudge → honest fallback
    (marked "_fallback": True so callers can log it truthfully)."""
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
