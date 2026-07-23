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
backend/            FastAPI app (api/evaluate → run_id → api/stream SSE);
                    every run goes through the One Shield agent
frontend/           React banking UI (phone frame, scenario rail, Mock/Real toggle)
oneshield_agents/   One Shield LangGraph agent (self-contained, notebook-ready;
                    prompts + fixtures inside its config/)
scenarios/          demo fixtures (coerced = grandparent story, bot, workout, ...)
docs/CONTRACTS.md   wire contract v2.2 (events: sentinel/invoke/step/result/adjudication)
runBook.md          operator card: notebook cells, demo beats, failure recovery
run.sh              cof launcher (sandbox client only)
requirements.txt    python deps (the c1 package is preinstalled — not listed)
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
from oneshield_agents.notebook import run_scenario
record = run_scenario("coerced")   # grandparent scam — expect step_up
```

## Environment reference

| Variable | Default | Meaning |
|---|---|---|
| `LLM_MODEL` | `llama-4-scout` | base model; `LLM_MODEL_<ROLE>` overrides per role |
| `ONESHIELD_LOG` | `1` | live operator log on the console (`0` silences) |
| `ONESHIELD_LLM_TIMEOUT` | `60` | seconds per model call |

That's the whole surface. There is no endpoint or key configuration — the
sandbox client owns routing.

## Troubleshooting

- **`ModuleNotFoundError: No module named 'c1'`** — the python running the
  server can't see the sandbox package. Launch from a **notebook cell**
  (runBook.md §1): `sys.executable` there is the kernel's python, which is
  usually the ONLY env with the c1 package. A terminal's `python3` is
  typically a different env. Check inside a notebook:
  `import c1; print(c1.__file__)`.
- **Shields all return "Signal unavailable" fallbacks** — the model call is
  failing; watch the console for `WARNING transport failed` lines. If the
  sandbox client's import path differs in this workspace, the only file to
  fix is `oneshield_agents/llm.py` (`make_chat_model`).
- **UI shows spinner forever in REAL mode** — backend not reachable; check
  `http://localhost:8000/api/health` (through the proxy if applicable).
- Full failure-recovery card: `runBook.md`.
