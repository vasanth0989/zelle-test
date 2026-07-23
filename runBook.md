# NeuroSecure — Run Book (cof / Linux / Jupyter edition)

Operator card: exact commands and clicks. This bundle targets the Capital
One sandbox — Linux only, no Windows commands anywhere.

## 1. Start everything

**From a workspace terminal** (preferred):

    pip install -r requirements.txt      # once
    chmod +x run.sh                      # once
    ./run.sh                             # builds UI if npm exists, serves :8000
    ./run.sh --skip-build                # restart without rebuilding

run.sh defaults to cof mode: ONESHIELD_AGENT=1 (LangGraph One Shield agent)
and ONESHIELD_LLM_PROVIDER=c1 (sandbox client, llama-4-scout — no base_url,
no api_key, ever).

**From a notebook** (no terminal):

    # Cell 1 — deps (once)
    !pip install -r requirements.txt

    # Cell 2 — start the server (rerun cell to restart)
    import os, subprocess, sys
    os.environ["ONESHIELD_AGENT"] = "1"
    os.environ["ONESHIELD_LLM_PROVIDER"] = "c1"
    server = subprocess.Popen([sys.executable, "-m", "uvicorn",
                               "backend.app:app", "--host", "0.0.0.0", "--port", "8000"])

    # Cell 3 — sanity check
    import httpx; httpx.get("http://localhost:8000/api/health").json()

    # To stop:  server.terminate()

**Agent-only smoke test** (no server, no UI):

    import os
    os.environ["ONESHIELD_LLM_PROVIDER"] = "c1"
    from oneshield_agents.notebook import run_scenario
    run_scenario("coerced")     # grandparent scam — expect step_up

**Browser tabs**: direct ports → http://localhost:8000/ and /#/panel.
Behind the Jupyter proxy → `<workspace-url>/proxy/8000/` and
`<workspace-url>/proxy/8000/#/panel` (relative URLs + hash routing were
built for exactly this).

## 2. Pre-flight (30 seconds)

- [ ] `api/health` answers (Cell 3 above, or the panel shows ACTIVE)
- [ ] Run one throwaway REAL send on **Everyday payment** to warm the model
- [ ] Reload the app tab so the flow starts fresh

## 3. The demo beats

The scenario rail drives everything: **flip the Mock/Real toggle**, click a
card (it arms + prefills), then on the phone: **Send money with Zelle®** →
review → tick the checkbox → **Send money**.

| # | Rail card | Mode | Expect |
|---|---|---|---|
| 1 | Everyday payment | MOCK then REAL | allow — Geo skipped ("low and in-pattern") |
| 2 | Grandparent scam | REAL | bio ~85 → presence ~35 → txn ~80 → geo ~85 → **Let's verify a few things** |
| 3 | Remote access takeover | REAL | presence high (automation) → **paused** |
| 4 | False-positive guard | REAL | HR 121 but explained by workout → allow |

MOCK mode is the scripted safety net — instant, zero LLM calls. REAL runs
take ~1–3 minutes depending on the model; the console under run.sh streams
the operator log (router rounds, shield results, verdict) live.

## 4. If something breaks

| Symptom | Action |
|---|---|
| Shields all say "signal unavailable" | Model calls failing — read the console WARNING lines; fix point is `oneshield_agents/llm.py` |
| Panel says "Backend unreachable" | `./run.sh --skip-build` (or rerun the server cell) |
| Server restarted | Scenario reset to normal — re-arm the rail card |
| REAL misbehaving mid-demo | Flip the toggle back to MOCK — the scripted tapes always work |

## 5. Legacy orchestrator path (fallback / consent flow)

ONESHIELD_AGENT=0 switches to the pre-agent parallel orchestrator (also used
automatically for interactive consent runs). On the EMP gateway it needs:

    os.environ["LLM_BASE_URL"] = "<gateway endpoint>"     # never commit
    os.environ["LLM_MODEL"] = "llama-3.3-70b"
    os.environ["LLM_MODEL_BIOMETRIC"] = "gemma-4-26b"
    os.environ["LLM_API_KEY"] = "<sandbox credential>"    # never commit
    os.environ["LLM_REQUEST_PROFILE"] = "c1-vllm"         # REQUIRED

Why c1-vllm is required: the gateway ERRORS on temperature:0 (greedy is its
do_sample:false default) and its max_new_tokens default of 20 truncates every
JSON reply; the profile sends max_new_tokens=512 instead. Do NOT "fix"
temperature back in. If raw HTTP auth is rejected, add
`LLM_TRANSPORT="c1-sdk"` (preinstalled EMP client, carries workspace auth) —
the single adaptation point is `backend/llm.py: chat()`.
