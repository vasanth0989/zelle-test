# One Shield agents (portable package)

A LangGraph tool-calling orchestrator for the NeuroSecure demo: **One Shield**
(a real LLM) decides which specialist Shields to invoke — Biometric and
Presence always first, Geo only when an anomaly needs corroborating — then
hands the evidence to the real Adjudicator. Every score and decision is model
output; only the sensor data is fixture material.

This folder is **self-contained by design** (own prompts, fixtures, parser):
copy it anywhere — including the team Jupyter workspace — and it runs.

## Layout

```
oneshield_agents/
  config/
    prompts/         # synced copies of repo prompts/*.md + one_shield.md
    fixtures/        # synced copies of scenarios/*.json (notebook runs only)
    tool_labels.json # tool -> shield key + display label
  config_loader.py   # fail-fast prompt/fixture loading
  llm.py             # THE environment switch: local Ollama vs c1 sandbox
  parsing.py         # defensive JSON extraction + contract validation
  shields.py         # one real LLM call per shield + tone/insight steps
  adjudicator.py     # signal_summary, policy floor, one reconsideration
  tools.py           # tool schemas bound to the router LLM (schemas only)
  agent.py           # StateGraph llm ⇄ tools, guard rails, wire mapping
  notebook.py        # standalone runners (Jupyter entry point)
```

## Run in this Jupyter workspace (Capital One sandbox)

In a notebook cell — no backend, no frontend, no config needed:

```python
import os
os.environ["ONESHIELD_LLM_PROVIDER"] = "c1"   # llama-4-scout via sandbox client
from oneshield_agents.notebook import run_scenario
record = run_scenario("coerced")   # grandparent scam — expect step_up
```

To use it from another folder (e.g. next to `behaviour_shield/`), copy the
whole `oneshield_agents/` directory there — it is self-contained.

## Run against a local OpenAI-compatible endpoint (dev rigs)

Defaults target Ollama (`http://localhost:11434/v1`, model `llama3.1:8b`):

```bash
python -c "from oneshield_agents import run_scenario; run_scenario('coerced')"
```

Or through the full demo: `ONESHIELD_AGENT=1` + uvicorn — see runBook.md.

No base_url / api_key anywhere: the sandbox's `create_chat_openai_model`
owns routing (same rule as the reference workspace's CLAUDE.md).

## Environment reference

| Variable | Default | Meaning |
|---|---|---|
| `ONESHIELD_LLM_PROVIDER` | `local` | `local` = ChatOpenAI→Ollama; `c1` = sandbox client |
| `LLM_BASE_URL` / `LLM_API_KEY` | Ollama defaults | local provider only |
| `LLM_MODEL` | `llama3.1:8b` local / `llama-4-scout` c1 | base model |
| `LLM_MODEL_<ROLE>` | — | per-role override (`ONE_SHIELD`, `BIOMETRIC`, …) |
| `ONESHIELD_LLM_TIMEOUT` | `60` | seconds per model call |
| `ONESHIELD_LOG` | `1` | live operator log on the console (`0` silences) |

## Guard rails (why routing stays on-script with 8B models)

- Biometric + Presence are **mandatory before any verdict** — an early
  `submit_verdict` is refused with a compliance note the model reads.
- Round cap (6): a stalled router degrades to platform-finished
  investigation — mandatory shields run, the rest marked skipped, the real
  Adjudicator still decides. A run never hangs and never fakes a verdict.
- Skipped shields become neutral no-information rows **before**
  adjudication (v2.2 contract), and the adjudicator's POLICY FLOOR +
  one-shot reconsideration are ported intact from the demo backend.

## Sync note

`config/prompts/` and `config/fixtures/` started as copies of the repo's
`prompts/` and `scenarios/` (Jul 22). The prompt copies now deliberately
diverge: each carries a **KEYNOTE OUTPUT STYLE** section (short-headline
rationale, ≤6-word steps, punchy adjudicator reasoning) that the legacy
backend's prompts do not have. If the originals' calibration bands change,
port the change over by hand — don't blind-copy, or the style section is
lost. The package never reaches outside its own folder.
