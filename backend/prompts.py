"""Prompt loading — files load ONCE at import, fail-fast if missing.

Hard rule: system prompts are fixed from prompts/*.md and NEVER vary by
scenario. Scenario changes the user-message data only.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIR = ROOT / "prompts"

AGENT_KEYS = ["transaction", "biometric", "context", "behavior", "adjudicator"]


def _read(name: str) -> str:
    path = PROMPTS_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"required prompt file missing: {path}")
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"prompt file is empty: {path}")
    return text


PROMPTS: dict[str, str] = {key: _read(f"{key}.md") for key in AGENT_KEYS}

# Appended to a shield's own system prompt for the escalated INITIAL call.
STAGED_INITIAL_SUFFIX: str = _read("_staged_initial.md")


def staged_initial_prompt(shield_key: str) -> str:
    return f"{PROMPTS[shield_key]}\n\n{STAGED_INITIAL_SUFFIX}"
