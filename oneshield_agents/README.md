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
  llm.py             # sandbox client plumbing (the single adaptation point)
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
from oneshield_agents.notebook import run_scenario
record = run_scenario("coerced")   # grandparent scam — expect step_up
```

To use it from another folder (e.g. next to `behaviour_shield/`), copy the
whole `oneshield_agents/` directory there — it is self-contained. This
bundle's llm.py speaks the sandbox client ONLY (`create_chat_openai_model`,
`llama-4-scout`) — no URLs, no keys, no other providers.

Or through the full demo: `./run.sh` — see runBook.md.

No base_url / api_key anywhere: the sandbox's `create_chat_openai_model`
owns routing (same rule as the reference workspace's CLAUDE.md).

## Environment reference

| Variable | Default | Meaning |
|---|---|---|
| `LLM_MODEL` | `llama-4-scout` | base model |
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
rationale, ≤6-word steps, punchy adjudicator reasoning). If the source
repo's calibration bands change,
port the change over by hand — don't blind-copy, or the style section is
lost. The package never reaches outside its own folder.
