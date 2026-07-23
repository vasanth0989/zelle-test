"""Config loading — prompts, tool labels, bundled fixtures.

Everything loads from this package's own config/ directory so the folder can
be copied into any workspace (Jupyter included) and just work. Prompts are
synced copies of the repo's prompts/*.md (hard rule: system prompts never
vary by scenario — scenario changes the user-message data only).

Fail-fast at import: a missing or empty prompt is a packaging error, not a
runtime condition.
"""
from __future__ import annotations

import json
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parent / "config"
PROMPTS_DIR = CONFIG_DIR / "prompts"
FIXTURES_DIR = CONFIG_DIR / "fixtures"

AGENT_KEYS = ["transaction", "biometric", "context", "behavior",
              "adjudicator", "one_shield"]


def _read(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"required prompt file missing: {path}")
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"prompt file is empty: {path}")
    return text


PROMPTS: dict[str, str] = {key: _read(PROMPTS_DIR / f"{key}.md") for key in AGENT_KEYS}

TOOL_LABELS: dict[str, dict] = json.loads(
    (CONFIG_DIR / "tool_labels.json").read_text(encoding="utf-8"))

# tool name -> internal shield key (submit_verdict maps to None)
TOOL_SHIELD: dict[str, str | None] = {
    name: meta["shield"] for name, meta in TOOL_LABELS.items()}


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.json").read_text(encoding="utf-8"))
