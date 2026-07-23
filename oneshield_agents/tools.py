"""Tool schemas bound to the One Shield LLM.

These functions exist to give the model a clean tool signature and docstring
(what LangChain sends as the tool spec). They are NEVER executed directly:
running a shield needs the run's data slices and the SSE emitter, which live
in graph state — so agent.tools_node owns execution and these bodies are
unreachable. (The reference workspace executes tool bodies because its tools
are self-contained; ours are not, by design.)
"""
from __future__ import annotations

from langchain_core.tools import tool


@tool
def run_biometric_shield(reason: str) -> str:
    """Read the customer's wearable vital signs (heart rate, respiration,
    skin temperature) and score acute stress or coercion. Data never leaves
    the device. Mandatory — run this first on every investigation.

    Args:
        reason: One short first-person line (<90 chars) telling the customer
            why you are running this check now. No internal jargon.
    """
    raise NotImplementedError("executed by agent.tools_node")


@tool
def run_presence_shield(reason: str) -> str:
    """Analyse live session telemetry (typing cadence, cursor path,
    hesitation) and score whether the real account holder is in control —
    bot, remote access, or guided behaviour. Mandatory — run this second.

    Args:
        reason: One short first-person line (<90 chars) telling the customer
            why you are running this check now. No internal jargon.
    """
    raise NotImplementedError("executed by agent.tools_node")


@tool
def run_transaction_shield(reason: str) -> str:
    """Score this payment against the customer's payment history: amount vs
    typical range, payee novelty, velocity, hour.

    Args:
        reason: One short first-person line (<90 chars) telling the customer
            why you are running this check now. No internal jargon.
    """
    raise NotImplementedError("executed by agent.tools_node")


@tool
def run_geo_shield(reason: str) -> str:
    """Score the semantic place and local time against the customer's
    habits. Optional — run it only when an anomaly (any score >= 55) needs
    corroborating or explaining; skip it when every score is low.

    Args:
        reason: One short first-person line (<90 chars) telling the customer
            why you are running this check now. No internal jargon.
    """
    raise NotImplementedError("executed by agent.tools_node")


@tool
def submit_verdict(reason: str) -> str:
    """Conclude the investigation: hand every collected assessment to the
    Adjudicator, which returns the bank's final decision (allow / step_up /
    pause). Call exactly once, only after the mandatory shields have run.

    Args:
        reason: One short first-person line (<90 chars) summing up why the
            evidence is complete. No internal jargon.
    """
    raise NotImplementedError("executed by agent.tools_node")


TOOLS = [run_biometric_shield, run_presence_shield, run_transaction_shield,
         run_geo_shield, submit_verdict]
