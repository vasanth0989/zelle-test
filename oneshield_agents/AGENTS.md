# AGENTS.md — who thinks, when, and how a Real call is orchestrated

Every box below is a REAL LLM call (core principle: we mock the evidence,
never the judgment). This file is the map to read before adding scenarios,
shields, or agents.

## The six agents in a Real call

| # | Agent (role key) | Kind | Calls per run | Job |
|---|---|---|---|---|
| 1 | **One Shield** (`one_shield`) | tool-calling router (LangGraph) | ~3–7 (one per round) | Decides WHICH shield runs next and narrates why. Never scores risk itself. |
| 2 | **Biometric Shield** (`biometric`) | JSON-contract specialist | 1 (mandatory) | Wearable vitals → acute stress / coercion score. |
| 3 | **Presence Shield** (`behavior`) | JSON-contract specialist | 1 (mandatory) | Live typing/cursor telemetry → bot / remote control / guided human. |
| 4 | **Transaction Shield** (`transaction`) | JSON-contract specialist | 0–1 | Payment vs history: amount, payee novelty, velocity, hour. |
| 5 | **Geo Shield** (`context`) | JSON-contract specialist | 0–1 (skippable) | Semantic place + local time vs habits. Runs only to corroborate an anomaly (any score ≥ 55); skipped when everything is low. |
| 6 | **Adjudicator** (`adjudicator`) | JSON-contract decider | 1 (+1 reconsideration max) | Final allow / step_up / pause from the four assessments + platform-computed signal_summary. Policy floor enforced. |

Typical grandparent run ≈ 10–13 LLM calls total: ~5 router rounds + 4
shields + 1–2 adjudicator.

Every role resolves its model independently: `LLM_MODEL_<ROLE>` env override
(e.g. `LLM_MODEL_BIOMETRIC=gemma3:12b`), else `LLM_MODEL`, else the provider
default (`llama3.1:8b` local / `llama-4-scout` c1). One heterogeneous fleet,
zero code changes.

## Orchestration — one run, start to finish

```
UI "Send money"                                  (frontend, REAL toggle)
  └─ POST api/evaluate ──► backend/app.py
       builds per-shield data slices (scope isolation: each shield sees
       ONLY its own domain + its own baseline view)
       └────────────────────► oneshield_agents.run_investigation(slices…)

run_investigation                                (agent.py)
  ├─ emits {"type":"sentinel"}  ← run starts, UI shows One Shield card
  └─ LangGraph StateGraph:

        START ──► llm ◄──────────── nudge
                   │  ▲                ▲
        tool calls │  │ ToolMessages   │ no tool calls & no verdict
                   ▼  │                │
                  tools ───────────────┘
                   │
                   └─► END  (verdict submitted | round cap | futile round)

  llm node    = One Shield router call. Its tool call's `reason` arg becomes
                the on-screen narration line + the invoke event.
  tools node  = executes the requested tool:
                • run_*_shield → emit invoke → evaluate_shield() → REAL LLM
                  call with the shield's calibrated prompt → step events
                  (tone/insight) + result event → ToolMessage back to the
                  router with the WHITELISTED view only
                  (score/confidence/rationale — never step text)
                • submit_verdict → unrun optional shields become skipped
                  no-information rows FIRST, then adjudicate()
  finalizer   = if the graph ends without a verdict (cap / stall / repeat):
                run missing mandatory shields; anomaly ≥ 55 → run the rest
                to corroborate, all low → mark skipped; then adjudicate().
                Deterministic application of the router's OWN rules — the
                run always ends, never hangs, never fakes a verdict.

adjudicate()                                     (adjudicator.py)
  assessments (whitelisted) + signal_summary (platform-computed arithmetic)
  → verdict; POLICY FLOOR violation → ONE reconsideration call → accept.

Wire events (docs/CONTRACTS.md v2.2 + tone/insight)
  sentinel → step(sentinel)/invoke/step/result per shield → adjudication
  └─► SSE api/stream ──► UI analysis sheet (paced) + operator console log
```

## Guard rails (why an 8B router stays on-script)

| Rail | Trigger | Effect |
|---|---|---|
| Mandatory order | submit_verdict before biometric+presence ran | Tool refuses with a compliance note; router retries |
| Nudge node | router replies with prose, no tool call | One corrective message listing exactly the unrun tools |
| Futile-round exit | a round only repeats already-run tools | Straight to finalizer (observed llama3.1 loop — never self-corrects) |
| Round cap | 10 llm rounds | Finalizer completes the run |
| Policy floor | verdict ≠ allow while all signals < 60 & biometrics present | One adjudicator reconsideration |

## How to expand

**New scenario (most common — no code, no prompts):**
1. Add `scenarios/<name>.json` (+ sync a copy into
   `oneshield_agents/config/fixtures/`): `biometrics`, `context`, optional
   `telemetry_override` (use it when live UI telemetry would contradict the
   story — see coerced.json), optional `escalate`/`sentinel_hint`.
2. Register the name in `backend/app.py` SCENARIO_NAMES.
3. Frontend card: `frontend/src/demoScenarios.js` (+ `backendKey` if the
   card key differs from the fixture name) and a mock tape in `mock.js`.
4. Notebook default payload: `oneshield_agents/notebook.py` DEFAULT_PAYLOADS.
Hard rule: scenarios change DATA ONLY. If a new scenario seems to need a
prompt edit, stop — it's either a calibration change (test all scenarios)
or it belongs in the fixture.

**New shield (new specialist agent):**
1. Prompt with calibration bands → `config/prompts/<key>.md` (+ keynote
   style section) and add the key to `config_loader.AGENT_KEYS`.
2. Tool schema in `tools.py` + entry in `config/tool_labels.json`.
3. Slice: BASELINE_VIEWS + slice builder in `backend/app.py` and
   `notebook.py` (scope isolation: only its own domain).
4. Classify it: MANDATORY tuple in `agent.py`, or optional (finalizer's
   corroborate-vs-skip already handles any optional shield).
5. Routing rule line in `config/prompts/one_shield.md`; UI display name in
   `frontend/src/shields.json`.

**New decider / sub-agent (e.g. a compliance check):** follow the
Adjudicator pattern — JSON contract in `parsing.py`, calibrated prompt,
`call_json_agent()` for the defensive path, deterministic inputs computed by
the platform, and give the router a tool for it only if the ROUTER should
decide when it runs.

## Modes for completeness

- MOCK (UI toggle): zero agents, scripted tapes in `frontend/src/mock.js` —
  the demo safety net.
- REAL: everything above (this file) — the only backend evaluation path in
  this bundle.
