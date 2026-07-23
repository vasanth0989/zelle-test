"""Adjudication — the real LLM decider, with the platform's guard rails.

Faithful port of the demo backend's hard-won calibration rules:
- The adjudicator sees score/confidence/rationale per shield ONLY (never step
  text) plus a deterministic signal_summary — the platform does the
  arithmetic so the model spends its judgment on WHY, not on reading numbers.
- POLICY FLOOR: biometrics available (or intentionally skipped) and every
  informative score below 60 → the decision must be "allow". A violating
  verdict triggers exactly ONE reconsideration call; if the model still
  disagrees we accept it (the floor only ever errs toward caution).
"""
from __future__ import annotations

from .config_loader import PROMPTS
from .llm import call_json_agent, resolve_model
from .parsing import ADJUDICATOR_FALLBACK, validate_adjudicator
from .shields import assessment_view

SHIELD_ORDER = ["transaction", "context", "biometric", "behavior"]


def signal_summary(results: dict[str, dict]) -> dict:
    informative = {k: v["score"] for k, v in results.items()
                   if not v.get("consent_declined") and not v.get("_fallback")
                   and not v.get("skipped")}
    return {
        "informative_scores": informative,
        "max_informative_score": max(informative.values(), default=0),
        "biometrics_available": "biometric" in informative,
        "skipped_shields": [k for k in SHIELD_ORDER if results.get(k, {}).get("skipped")],
    }


async def adjudicate(results: dict[str, dict], transaction: dict, consent: dict) -> dict:
    summary = signal_summary(results)
    payload = {
        "assessments": {k: assessment_view(v) for k, v in results.items()},
        "signal_summary": summary,
        "transaction": transaction,
        "consent": consent,
    }
    verdict = await call_json_agent("adjudicator", PROMPTS["adjudicator"], payload,
                                    validate_adjudicator, ADJUDICATOR_FALLBACK)

    floor_applies = (summary["biometrics_available"]
                     or "biometric" in summary["skipped_shields"])
    if (floor_applies and summary["max_informative_score"] < 60
            and verdict["decision"] != "allow" and not verdict.get("_fallback")):
        bio_state = ("biometrics are available" if summary["biometrics_available"]
                     else "the biometric probe was intentionally skipped by One Shield")
        reconsidered = await call_json_agent(
            "adjudicator", PROMPTS["adjudicator"],
            {**payload, "policy_note": (
                f"Compliance check: signal_summary.max_informative_score is "
                f"{summary['max_informative_score']} (below 60) and {bio_state}. "
                f"Your previous decision {verdict['decision']!r} violates the "
                f"POLICY FLOOR, which requires 'allow' in this case. "
                f"Re-evaluate and return your JSON decision.")},
            validate_adjudicator, ADJUDICATOR_FALLBACK)
        if not reconsidered.get("_fallback"):
            verdict = reconsidered

    return {**verdict, "model": resolve_model("adjudicator")}
