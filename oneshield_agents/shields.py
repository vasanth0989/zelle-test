"""Shield evaluation — one real LLM call per shield, our calibrated prompts.

Core principle preserved: mock the evidence, never the judgment. The data
slice a shield sees is fixture/telemetry material assembled by the caller;
the score/confidence/rationale/steps are always a real model's output.

The agent path uses a single full-slice call per shield (the legacy backend's
two-stage escalation is orchestration theater that One Shield's own narration
now provides). Scope isolation holds: each shield sees only its own slice.
"""
from __future__ import annotations

from .config_loader import PROMPTS
from .llm import call_json_agent, resolve_model
from .parsing import SHIELD_FALLBACK, validate_shield

# What the UI's finished card shows under the big chip — tone is derived from
# the score the model itself produced, so the styling never invents judgment.
def tone_for(score: int) -> str:
    if score >= 70:
        return "alert"
    if score <= 40:
        return "ok"
    return "note"


def assessment_view(result: dict) -> dict:
    """What the One Shield LLM and the Adjudicator see per shield:
    score/confidence/rationale ONLY. Feeding step narrative text to the
    deciders measurably poisons them (hard-won calibration rule 2)."""
    view = {k: result[k] for k in ("score", "confidence", "rationale") if k in result}
    if result.get("consent_declined"):
        view["consent_declined"] = True
    if result.get("skipped"):
        view["skipped"] = True
    return view


def skipped_result(note: str) -> dict:
    """Neutral no-information placeholder for a shield One Shield chose not
    to run — same shape the adjudicator already handles for declined consent."""
    return {
        "score": 50,
        "confidence": "low",
        "rationale": note or "Not evaluated — One Shield concluded from the other signals.",
        "steps": ["One Shield decision → skipped"],
        "skipped": True,
    }


# Opening line per shield — streams the instant the shield spins up, before
# its LLM call returns (mock-parity keynote captions, jargon-free).
OPENING_STEP = {
    "biometric": "Reading wearable vitals",
    "behavior": "Watching typing and touch",
    "transaction": "Checking your payment pattern",
    "context": "Reading the setting",
}


async def evaluate_shield(key: str, data_slice: dict, *, emit=None) -> dict:
    """Run one shield: stream honest step lines via emit, return the
    validated result dict (with dev-overlay model metadata attached)."""
    steps: list[str] = []

    async def step(text: str, **extra):
        steps.append(text)
        if emit:
            await emit({"type": "step", "shield": key, "text": text, **extra})

    await step(OPENING_STEP.get(key, f"Loaded {key} data"), tone="note")
    result = await call_json_agent(key, PROMPTS[key], data_slice,
                                   validate_shield, SHIELD_FALLBACK)
    # Line tone follows the score the model itself produced (✓ / › / ⚠ in
    # the UI) — styling derived from judgment, never invented.
    line_tone = tone_for(result["score"])
    for model_step in result.get("steps", []):
        await step(model_step, tone=line_tone)
    # The one-line rationale is the shield's own conclusion — it renders as
    # the UI's insight pill (mock-parity fields tone/insight, honest content).
    if emit:
        await emit({"type": "step", "shield": key,
                    "text": result["rationale"], "insight": True})

    combined = {**result, "steps": steps,
                "model": resolve_model(key), "escalated": True}
    if emit:
        await emit({"type": "result", "shield": key, **combined})
    return combined
