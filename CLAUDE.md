# NeuroSecure / One Shield — cof workspace instructions (Claude, read first)

Real-time scam detection for Zelle payments, shipped from the local demo rig
into this Capital One Jupyter workspace. At the moment of send, **One Shield**
(a real tool-calling LLM router, LangGraph) decides which specialist Shields
to run; every Shield and the final Adjudicator are real LLM calls.

**Core principle — never violate it: we mock the EVIDENCE (fixtures,
telemetry, wearable data), never the JUDGMENT. Every score, routing decision,
and verdict must come from a real model call. No scripted scores, no if/else
verdicts on the real path.**

## Environment facts (this workspace)

- **Linux + Jupyter only.** Never write PowerShell, .ps1/.bat files, Windows
  paths, or CRLF line endings. Shell = bash; scripts must stay LF.
- LLM access is ONLY through the sandbox client:
  `from c1.genai.integrations.langchain.inference import create_chat_openai_model`,
  model `llama-4-scout`. **Never set or ask for base_url / api_key — the
  sandbox owns routing. Never commit or print credentials.**
- The c1 client is sync-only; every call already runs through
  `asyncio.to_thread` in `oneshield_agents/llm.py`. Keep it that way.
- Run: `./run.sh` (terminal) or the notebook cells in runBook.md §1.
  Agent-only smoke test: `oneshield_agents.notebook.run_scenario("coerced")`.
- Behind the Jupyter proxy the app is `<workspace-url>/proxy/8000/` — all
  URLs are relative + hash routing. NEVER introduce an absolute URL or
  non-hash route in the frontend.

## Naming (locked by the team — never rename, on screen or in copy)

- Orchestrator = **"One Shield"** (never "Sentinel" on screen).
- **Geo Shield** (internal key `context`), **Presence Shield** (internal key
  `behavior`), **Biometric Shield** (first, with the lock badge "Data never
  leaves this device"), **Transaction Shield**. Deciding agent = Adjudicator.
- Internal code keys stay stable: `transaction`, `biometric`, `context`,
  `behavior`. Display names come from `frontend/src/shields.json`.

## Architecture (what lives where)

```
frontend/           React banking UI. Mock/Real toggle on the scenario rail:
                    MOCK = scripted tapes in src/mock.js (the demo safety
                    net — NEVER edit the tapes casually); REAL = backend.
backend/app.py      POST api/evaluate -> {run_id} -> GET api/stream (SSE).
                    ONESHIELD_AGENT=1 routes runs through the agent package;
                    =0 uses the legacy parallel orchestrator (also used for
                    interactive consent runs). Contracts: docs/CONTRACTS.md
                    v2.2 + step fields tone/insight.
oneshield_agents/   The agent (self-contained: own prompts/fixtures/parser —
                    it must NEVER import from backend/). StateGraph
                    llm <-> tools; tools run real shield LLM calls.
prompts/            legacy-path prompts. oneshield_agents/config/prompts/
                    are DIVERGED copies (keynote-brevity style section) —
                    port calibration changes by hand, never blind-copy.
```

## Hard-won calibration rules (do NOT undo — each fixed a real failure)

1. Shield prompts carry numeric calibration bands; the adjudicator has a
   POLICY FLOOR (+ one reconsideration call). 8–12B models hedge to 50
   without anchors.
2. The router LLM and the Adjudicator see score/confidence/rationale ONLY —
   never step text (narrative steps measurably poison them) — plus a
   platform-computed signal_summary (the platform does arithmetic; the model
   judges WHY).
3. Shields the router skips become neutral 50/low no-information rows BEFORE
   adjudication.
4. Router guard rails: Biometric + Presence mandatory before any verdict;
   nudge node for stalled routers; a futile round (repeating an already-run
   tool) hands to the finalizer, which applies the router's own rules
   deterministically (anomaly >= 55 => remaining shields corroborate; all
   low => skipped). MAX_ROUNDS=10.
5. System prompts load from files and NEVER vary by scenario — scenario
   changes user-message data only.
6. Legacy path on the EMP gateway: LLM_REQUEST_PROFILE=c1-vllm is REQUIRED
   (temperature:0 is a gateway ERROR; greedy = do_sample:false;
   max_new_tokens=512 or JSON truncates at the gateway default of 20).

## Output style (Shantanu's rule — judge-facing screens)

Short and sweet, keynote captions, minimal words: shield rationale <= 6 words
("Acute stress detected"), steps <= 6 words leading with the number
("Heart racing — 118 vs 62"), adjudicator reasoning <= 12 words. No jargon,
no field names, no scores in customer-facing text. The style lives in the
KEYNOTE OUTPUT STYLE sections of oneshield_agents/config/prompts/*.md.

## Working agreements

- UI-first, demo-grade: build fast, hand over for a human visual check.
  No unit-test suites unless asked.
- MOCK mode is the demo; REAL mode is the proof-it's-real encore. Anything
  that risks the mock tapes or the toggle is a demo risk — treat as such.
- Defensive LLM handling everywhere: extract-first-JSON, one retry with a
  nudge, honest neutral fallback marked `_fallback: true`. Failures degrade
  safe (protective step_up), never crash a run and never fake a verdict.
- Single adaptation points: sandbox/LLM plumbing changes go in
  `oneshield_agents/llm.py` (agent) or `backend/llm.py: chat()` (legacy) —
  nowhere else.
- Operator log: every run streams to the console (ONESHIELD_LOG=0 silences).
  When debugging, read the WARNING lines before touching code.

## Verify a change (the acceptance bar)

1. `run_scenario("coerced")` → step_up, all four shields, keynote-short text.
2. `run_scenario("normal")` → allow, Geo skipped ("low and in-pattern").
3. Full stack: `./run.sh`, REAL toggle, Grandparent card, one-tap send →
   the analysis sheet streams and routes to the verification screen.
