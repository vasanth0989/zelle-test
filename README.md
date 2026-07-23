# NeuroSecure / One Shield — cof deployment bundle

Real-time scam detection for Zelle payments. At the moment of send, **One
Shield** (a real tool-calling LLM router, LangGraph) decides which specialist
Shields to invoke — Biometric and Presence always first, Geo only when an
anomaly needs corroborating — each Shield is a real LLM call, and a real
Adjudicator (policy floor + one reconsideration) makes the final
allow / step_up / pause decision. **We mock the evidence, never the judgment.**

This folder is source-only (no node_modules, no dist, no venv) and is
prepared for the Capital One sandbox: the same integration pattern as the
team's Jupyter workspace (`create_chat_openai_model`, model `llama-4-scout`,
sync client run in a worker thread — base_url/api_key belong to the sandbox
and are never set in code or env).

## Layout

```
backend/            FastAPI app (api/evaluate → run_id → api/stream SSE)
frontend/           React banking UI (phone frame, scenario rail, Mock/Real toggle)
oneshield_agents/   One Shield LangGraph agent (self-contained, notebook-ready)
prompts/            legacy-orchestrator prompts (calibrated — do not edit casually)
scenarios/          demo fixtures (coerced = grandparent story, bot, workout, ...)
docs/CONTRACTS.md   wire contract v2.2 (events: sentinel/invoke/step/result/adjudication)
runBook.md          operator card: EMP model names, Jupyter cells, failure recovery
run.sh              cof launcher (agent mode + sandbox provider by default)
requirements.txt    python deps (c1 packages are preinstalled — not listed)
```

## One-time setup

```bash
pip install -r requirements.txt
```

Frontend build needs node once (or copy a prebuilt `frontend/dist` in):

```bash
cd frontend && npm install && npm run build
```

## Run

```bash
./run.sh              # builds UI if npm exists, serves everything on :8000
./run.sh --skip-build # reuse the existing frontend/dist
```

Open `http://localhost:8000/` — behind a Jupyter proxy use
`<workspace-url>/proxy/8000/` (all URLs are relative + hash routing, so the
proxy prefix is safe). Control panel: `/#/panel`.

**Demo flow:** the app starts in MOCK mode (scripted tapes — the safe demo).
Flip the rail toggle to **REAL**, arm a scenario card (Grandparent Scam →
backend fixture `coerced`), tap "Send money with Zelle®", tick the
confirmation, Send. The analysis sheet streams the live agent run; the
console below `run.sh` shows the operator log (router rounds, tool calls,
shield results, verdict).

## Notebook-only quick start (no backend, no frontend)

```python
import os
os.environ["ONESHIELD_LLM_PROVIDER"] = "c1"
from oneshield_agents.notebook import run_scenario
record = run_scenario("coerced")   # grandparent scam — expect step_up
```

## Environment reference (run.sh cof defaults in bold)

| Variable | cof default | Meaning |
|---|---|---|
| `ONESHIELD_AGENT` | **1** | route evaluations through the One Shield agent |
| `ONESHIELD_LLM_PROVIDER` | **c1** | sandbox client; `local` = OpenAI-compatible HTTP (Ollama) |
| `LLM_MODEL` | `llama-4-scout` (c1) | base model; `LLM_MODEL_<ROLE>` overrides per role |
| `ONESHIELD_LOG` | **1** | live operator log on the console (`0` silences) |
| `ONESHIELD_LLM_TIMEOUT` | `60` | seconds per model call |
| `LLM_REQUEST_PROFILE` | **c1-vllm** | legacy path only: gateway dialect (greedy = `do_sample:false`, `max_new_tokens` required) |
| `LLM_TRANSPORT` | `http` | legacy path only: set `c1-sdk` if raw HTTP auth fails (runBook §5) |

## Troubleshooting

- **Shields all return "Signal unavailable" fallbacks** — the model call is
  failing; watch the console for `WARNING transport failed` lines. On c1 that
  usually means the sandbox client import path changed; the only file to fix
  is `oneshield_agents/llm.py` (`make_chat_model`).
- **Legacy path truncates JSON** — the gateway default of 20 tokens; keep
  `LLM_REQUEST_PROFILE=c1-vllm` (sends `max_new_tokens=512`).
- **UI shows spinner forever in REAL mode** — backend not reachable; check
  `http://localhost:8000/api/health` (through the proxy if applicable).
- Full failure-recovery card: `runBook.md`.
