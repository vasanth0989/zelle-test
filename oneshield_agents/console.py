"""Operator console logging — a human-readable stream of every run.

Whatever drives the agent (backend SSE, notebook cell, CLI), the console
shows the investigation live: router rounds, tool invocations, shield steps,
results, verdict, and any fallback. Default ON; silence with ONESHIELD_LOG=0.

Markers are ASCII on purpose — model text may carry unicode, but our own
decorations must survive any Windows console/pipe encoding.
"""
from __future__ import annotations

import os


def enabled() -> bool:
    return os.environ.get("ONESHIELD_LOG", "1") != "0"


def log(line: str) -> None:
    if not enabled():
        return
    try:
        print(line, flush=True)
    except UnicodeEncodeError:  # cp1252 pipe — degrade, never crash a run
        print(line.encode("ascii", errors="replace").decode("ascii"), flush=True)


_TONE_MARKER = {"alert": "!", "ok": "+"}


def format_event(evt: dict) -> str:
    kind = evt.get("type")
    if kind == "step":
        who = evt.get("shield", "?")
        marker = "*" if evt.get("insight") else _TONE_MARKER.get(evt.get("tone"), "-")
        return f"  [{who:>11}] {marker} {evt.get('text', '')}"
    if kind == "invoke":
        return f"[ one shield] -> invoke {evt.get('shield')}: {evt.get('reason', '')}"
    if kind == "result":
        tag = "SKIPPED" if evt.get("skipped") else f"{evt.get('score')}/{evt.get('confidence')}"
        return f"[{evt.get('shield', '?'):>11}] RESULT {tag} - {evt.get('rationale', '')}"
    if kind == "adjudication":
        return (f"[adjudicator] VERDICT {evt.get('decision')} "
                f"(risk {evt.get('risk_score')}, method {evt.get('step_up_method')}) "
                f"- {evt.get('reasoning', '')}")
    if kind == "sentinel":
        return f"[ one shield] run start - router model {evt.get('model')}"
    return f"[{kind}] {evt}"


def log_event(evt: dict) -> None:
    log(format_event(evt))
