# NeuroSecure — Run Book (cof / Linux / Jupyter)

Operator card: exact commands and clicks. One evaluation path everywhere:
the One Shield agent via the sandbox client. No URLs, no api keys.

## 1. Start everything

**From a notebook** (PREFERRED — the c1 package usually exists ONLY in the
notebook kernel's python; a terminal's python3 is a different env and will
fail with `No module named 'c1'`):

    # Cell 1 — deps (once)
    !pip install -r requirements.txt

    # Cell 2 — start the server (rerun cell to restart)
    import subprocess, sys
    server = subprocess.Popen([sys.executable, "-m", "uvicorn",
                               "backend.app:app", "--host", "0.0.0.0", "--port", "8000"])

    # Cell 3 — sanity check
    import httpx; httpx.get("http://localhost:8000/api/health").json()

    # To stop:  server.terminate()

**From a workspace terminal** — only if `python3 -c "import c1"` succeeds
there:

    pip install -r requirements.txt      # once
    chmod +x run.sh                      # once
    ./run.sh                             # builds UI if npm exists, serves :8000
    ./run.sh --skip-build                # restart without rebuilding

**Agent-only smoke test** (no server, no UI):

    from oneshield_agents.notebook import run_scenario
    run_scenario("coerced")     # grandparent scam — expect step_up

**Browser tabs**: direct ports → http://localhost:8000/ and /#/panel.
Behind the Jupyter proxy → `<workspace-url>/proxy/8000/` and
`<workspace-url>/proxy/8000/#/panel` (relative URLs + hash routing were
built for exactly this).

## 2. Pre-flight (30 seconds)

- [ ] `api/health` answers (Cell 3 above)
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

Privacy Choice (consent flow) is MOCK-only in this bundle — don't run it in
REAL mode.

MOCK mode is the scripted safety net — instant, zero LLM calls. REAL runs
take a few minutes depending on the model; the console streams the operator
log (router rounds, shield results, verdict) live.

## 4. If something breaks

| Symptom | Action |
|---|---|
| `No module named 'c1'` | The server's python isn't the notebook kernel's — launch via the notebook cells in §1 |
| Shields all say "signal unavailable" | Model calls failing — read the console WARNING lines; single fix point: `oneshield_agents/llm.py` |
| Panel says "Backend unreachable" | Rerun the server cell (or `./run.sh --skip-build`) |
| Server restarted | Scenario reset to normal — re-arm the rail card |
| REAL misbehaving mid-demo | Flip the toggle back to MOCK — the scripted tapes always work |
