"""One Shield — a LangGraph tool-calling orchestrator (the real-LLM router).

Graph shape mirrors the reference Jupyter workspace:

    START → llm ⇄ tools → END

The LLM decides which shield to invoke next (observe → reason → act); the
tools node executes real shield evaluations against this run's data slices
and streams v2.2 wire events (plus the pivoted UI's tone/insight step
fields). Deterministic guard rails keep an 8B-class router on-rails:

- mandatory order: biometric and presence (behavior) must run before any
  verdict — an early submit_verdict is refused with a compliance note;
- decision cap: after MAX_ROUNDS the platform finishes the investigation
  itself (runs nothing extra, skips what the model skipped, adjudicates) —
  a stalled router degrades gracefully, it never hangs a run;
- unknown / repeated tool calls get an honest ToolMessage, never a crash.

Wire mapping (docs/CONTRACTS.md v2.2):
  llm narration text            → step events, shield "sentinel"
  tool call (run_*_shield)      → invoke event {shield, reason}
  shield evaluation             → step events (tone/insight) + result event
  submit_verdict                → adjudication event (via adjudicator.py)
"""
from __future__ import annotations

from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import (AIMessage, BaseMessage, HumanMessage,
                                     SystemMessage, ToolMessage)
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from .adjudicator import adjudicate
from .config_loader import PROMPTS, TOOL_SHIELD
from .console import log, log_event
from .llm import ainvoke, make_chat_model, resolve_model
from .shields import assessment_view, evaluate_shield, skipped_result
from .tools import TOOLS

MANDATORY = ("biometric", "behavior")  # biometric + presence, always
# Each llm turn costs a round, including turns a nudge recovers from — a
# full four-shield tour + verdict needs ~5 productive turns, so leave slack.
MAX_ROUNDS = 10


class OneShieldState(TypedDict):
    """Graph state. `emit` is an async callable(dict) that receives wire
    events — carried in state so the graph stays a pure LangGraph citizen
    (same trick as passing user_id in the reference workspace)."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    slices: dict          # per-shield data slices (scope isolation upheld)
    transaction: dict     # payment summary for the adjudicator
    consent: dict
    results: dict         # shield key -> validated result
    adjudication: dict | None
    rounds: int
    futile: int           # tool rounds that only repeated already-run tools
    emit: object


def _summarize_payment(state: OneShieldState) -> dict:
    txn = state["transaction"] or {}
    baseline = state["slices"]["transaction"]["baseline"]
    return {
        "transaction": {"amount": txn.get("amount"), "payee": txn.get("payee"),
                        "payee_first_seen": txn.get("payee_first_seen"),
                        "channel": txn.get("channel")},
        "baseline": {"typical_txn_range_usd": baseline.get("typical_txn_range_usd")},
        "consent": {"biometrics": state["consent"].get("biometrics", True)},
    }


def _build_messages(state: OneShieldState) -> list[BaseMessage]:
    import json
    return [
        SystemMessage(content=PROMPTS["one_shield"]),
        HumanMessage(content=(
            "Payment to assess:\n" + json.dumps(_summarize_payment(state))
            + "\nBegin your investigation now.")),
    ]


async def llm_node(state: OneShieldState) -> dict:
    rounds = state["rounds"] + 1
    messages = list(state["messages"]) or _build_messages(state)
    model = make_chat_model("one_shield", tools=TOOLS)
    response: AIMessage = await ainvoke(model, messages)
    requested = [tc["name"] for tc in (response.tool_calls or [])]
    log(f"[ one shield] round {rounds}/{MAX_ROUNDS}: "
        + (f"requesting {', '.join(requested)}" if requested
           else "no tool calls - nudging" if rounds < MAX_ROUNDS
           else "no tool calls - round cap, finalizing"))
    if state["messages"]:
        return {"messages": [response], "rounds": rounds}
    return {"messages": [*messages, response], "rounds": rounds}


async def tools_node(state: OneShieldState) -> dict:
    emit = state["emit"]
    results = dict(state["results"])
    adjudication = state["adjudication"]
    new_messages: list[BaseMessage] = []
    last = state["messages"][-1]
    productive = False  # any fresh evaluation, verdict, or corrective refusal

    async def narrate(text: str):
        await emit({"type": "step", "shield": "sentinel", "text": text})

    for tc in getattr(last, "tool_calls", None) or []:
        name = tc["name"]
        reason = str(tc.get("args", {}).get("reason", "")).strip()
        shield = TOOL_SHIELD.get(name)

        if name == "submit_verdict":
            missing = [k for k in MANDATORY if k not in results]
            if missing:
                productive = True  # corrective feedback the model acts on
                content = (f"Refused: mandatory shields not yet run: {missing}. "
                           f"Run them before submitting a verdict.")
            elif adjudication is not None:
                content = "Verdict already submitted."
            else:
                productive = True
                if reason:
                    await narrate(reason)
                # Shields the router deliberately never invoked become
                # explicit skipped rows BEFORE adjudication, so the
                # Adjudicator sees them as no-information (v2.2 contract)
                # and the UI shows its slim SKIPPED rows.
                for key in ("transaction", "context"):
                    if key not in results:
                        skipped = skipped_result(
                            "One Shield concluded from the other signals.")
                        results[key] = skipped
                        await emit({"type": "result", "shield": key, **skipped})
                adjudication = await adjudicate(results, state["transaction"],
                                                state["consent"])
                content = f"Verdict: {adjudication['decision']} (risk {adjudication['risk_score']})"
            new_messages.append(ToolMessage(content=content, tool_call_id=tc["id"]))
            continue

        if shield is None:
            new_messages.append(ToolMessage(
                content=f"Unknown tool: {name}", tool_call_id=tc["id"]))
            continue
        if shield in results:
            new_messages.append(ToolMessage(
                content=f"{shield} already evaluated: "
                        f"{assessment_view(results[shield])}. "
                        f"{_next_actions_hint(results)}",
                tool_call_id=tc["id"]))
            continue

        productive = True
        if reason:
            await narrate(reason)
        await emit({"type": "invoke", "shield": shield, "reason": reason})
        result = await evaluate_shield(shield, state["slices"][shield], emit=emit)
        results[shield] = result
        # The router LLM sees the same whitelist as the adjudicator —
        # score/confidence/rationale, never step text (calibration rule 2).
        new_messages.append(ToolMessage(
            content=str(assessment_view(result)), tool_call_id=tc["id"]))

    return {"messages": new_messages, "results": results,
            "adjudication": adjudication,
            "futile": 0 if productive else state["futile"] + 1}


# One-shot course correction for a router that stops calling tools mid-run —
# the same compliance-nudge pattern that keeps the adjudicator on the policy
# floor. Bounded by MAX_ROUNDS, so a truly stalled model still ends cleanly.
NUDGE = (
    "Compliance check: the investigation is not finished — you have not "
    "submitted a verdict. Continue now: call the next tool per the routing "
    "rules (mandatory shields first, then the transaction check; geo only "
    "when an anomaly needs corroborating; then submit_verdict).")

_TOOL_FOR_SHIELD = {v: k for k, v in TOOL_SHIELD.items() if v}


def _next_actions_hint(results: dict) -> str:
    """Spell out the legal next moves — 8B routers loop on an already-run
    tool unless the remaining set is put right in front of them."""
    remaining = [_TOOL_FOR_SHIELD[k]
                 for k in ("biometric", "behavior", "transaction", "context")
                 if k not in results]
    if remaining:
        return (f"Tools you have NOT run yet: {', '.join(remaining)}. Never "
                f"call a tool twice. When the evidence is complete, call "
                f"submit_verdict.")
    return "Every shield has run. Call submit_verdict now."


async def nudge_node(state: OneShieldState) -> dict:
    return {"messages": [HumanMessage(
        content=f"{NUDGE} {_next_actions_hint(state['results'])}")]}


def _after_llm(state: OneShieldState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    if state["adjudication"] is None and state["rounds"] < MAX_ROUNDS:
        return "nudge"
    return END  # round cap hit — the finalizer closes out honestly


def _after_tools(state: OneShieldState) -> str:
    if state["adjudication"] is not None or state["rounds"] >= MAX_ROUNDS:
        return END
    if state["futile"] >= 1:
        # A round that only repeated already-run tools — observed llama3.1:8b
        # failure mode that never self-corrects. Hand over to the finalizer
        # (which applies the router's own rules) instead of burning rounds.
        log("[ one shield] router repeating itself - handing to the finalizer")
        return END
    return "llm"


def build_graph() -> StateGraph:
    graph = StateGraph(OneShieldState)
    graph.add_node("llm", llm_node)
    graph.add_node("tools", tools_node)
    graph.add_node("nudge", nudge_node)
    graph.add_edge(START, "llm")
    graph.add_conditional_edges(
        "llm", _after_llm, {"tools": "tools", "nudge": "nudge", END: END})
    graph.add_conditional_edges("tools", _after_tools, {"llm": "llm", END: END})
    graph.add_edge("nudge", "llm")
    return graph


def compile_agent():
    return build_graph().compile()


async def run_investigation(slices: dict, transaction: dict, consent: dict,
                            emit=None) -> dict:
    """Full One Shield run onto `emit` (async callable receiving wire-event
    dicts; None = console log only). Returns {"results", "adjudication"}.
    This is the entry point backend/app.py and the notebook runner share.
    Every event is also logged to the console (ONESHIELD_LOG=0 silences)."""
    downstream = emit

    async def emit(evt: dict):  # noqa: F811 — deliberate wrap of the param
        log_event(evt)
        if downstream:
            await downstream(evt)

    await emit({"type": "sentinel", "model": resolve_model("one_shield")})

    agent = compile_agent()
    initial: OneShieldState = {
        "messages": [], "slices": slices, "transaction": transaction,
        "consent": consent, "results": {}, "adjudication": None,
        "rounds": 0, "futile": 0, "emit": emit,
    }
    try:
        final = await agent.ainvoke(initial)
        results = dict(final["results"])
        adjudication = final["adjudication"]
    except Exception as exc:
        # Router hard-failure (e.g. provider misconfigured: "No module named
        # 'c1'"). Degrade safe, never kill the stream: the finalizer below
        # completes the run — shield/adjudicator calls have their own honest
        # fallbacks, so the customer still gets a protective verdict.
        log(f"[ one shield] ERROR router failed ({exc.__class__.__name__}: {exc}) "
            f"- finalizing without it")
        results = {}
        adjudication = None

    # Finalizer — the graph ended without a verdict (round cap, a stalled or
    # repeating router). Finish by the router's OWN routing rules,
    # deterministically (the Sentinel compliance-check pattern): mandatory
    # shields always run; an anomaly >= 55 means the remaining shields
    # corroborate it; all-low evidence means they are skipped. The real
    # Adjudicator always decides.
    if adjudication is None:
        for key in MANDATORY:
            if key not in results:
                await emit({"type": "invoke", "shield": key,
                            "reason": "completing the mandatory checks"})
                results[key] = await evaluate_shield(key, slices[key], emit=emit)

        def informative_max() -> int:
            scores = [v["score"] for v in results.values()
                      if not v.get("skipped") and not v.get("_fallback")
                      and not v.get("consent_declined")]
            return max(scores, default=0)

        for key in ("transaction", "context"):
            if key in results:
                continue
            if informative_max() >= 55:
                await emit({"type": "invoke", "shield": key,
                            "reason": "an anomaly needs corroborating from every angle"})
                results[key] = await evaluate_shield(key, slices[key], emit=emit)
            else:
                skipped = skipped_result("Everything so far is low and in-pattern.")
                results[key] = skipped
                await emit({"type": "result", "shield": key, **skipped})
        adjudication = await adjudicate(results, transaction, consent)

    await emit({"type": "adjudication", **adjudication})
    return {"results": results, "adjudication": adjudication}
