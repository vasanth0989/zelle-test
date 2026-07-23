# API & Data Contracts — v2 (post Jul 20 review)

## POST api/scenario
Req: {"name": "normal"|"coerced"|"bot"|"workout"|"no_consent"}
Res: {"active": "<name>"}

## POST api/evaluate
Req: {
  "transaction": {"amount": num, "payee": str, "payee_first_seen": bool,
                   "channel": "zelle", "memo": str|null},
  "telemetry":   {"mouse_path_linearity": 0..1, "typing_cadence_var_ms": num,
                   "hesitation_before_send_ms": num, "field_fill": "typed|paste_all"},
  "consent":     {"biometrics": bool, "temporary": bool (optional),
                  "offer_declined": bool (optional — customer ignored the
                  temporary-permission offer; adjudicator re-decides without
                  biometrics and must not offer again)},
  "challenge_passed": bool (optional, step-up continuation),
  "challenge_timing_ms": int|null (optional, with challenge_passed — time the
                         customer took to answer the scam-interruption
                         questions; logged as an on-device pacing signal,
                         not yet used in decisioning)
}
Res: {"run_id": str}  (?sync=1 → inline "results" for spinner mode)

## GET api/stream?run_id=...
SSE, interleaved in real completion order. v2.2 (Sentinel routing) adds three
additive shapes; pre-v2.2 clients can ignore them safely.

SENTINEL meta event (first, v2.2): data: {"type":"sentinel","model":"llama3.1:8b"}

Sentinel routing steps stream as ordinary STEP events with shield "sentinel".

INVOKE event (v2.2, before a shield's first step — the Sentinel spun it up):
  data: {"type":"invoke","shield":"context","reason":"<sentinel thinking line>"}
  Shields invoked in the same routing decision run in PARALLEL.

STEP event (streamed live as staged evaluation proceeds):
  data: {"type":"step","shield":"biometric",
         "text":"Tool call: HealthKit (mock) → heart rate 118 bpm"}

RESULT event (one per shield):
  data: {"type":"result","shield":"biometric","score":85,"confidence":"high",
         "rationale":"...","steps":["...","..."],"consent_declined":false,
         "model":"gemma3:12b","escalated":true}
  model/escalated (v2.1, additive): dev-overlay metadata — which LLM produced
  the verdict and whether the staged path ran. UI shows them only in the
  panel's Developer view; NEVER adjudicator input (_assessment_view whitelist).
  skipped (v2.2, additive): true when the Sentinel chose NOT to run this
  shield — score is the neutral 50/low placeholder, rationale carries the
  Sentinel's skip_note. UI renders a slim "SKIPPED" row; the adjudicator
  treats it as no-information (excluded from informative_scores; listed in
  signal_summary.skipped_shields).

CONSENT_REQUEST event (mid-run, only when consent.biometrics=false AND the run
is escalated): the run PAUSES after this event — the adjudicator waits for the
customer's answer via POST api/respond before deciding.
  data: {"type":"consent_request","method":"temporary_biometric_permission",
         "message":"<customer-facing offer text>"}
On grant=true the biometric shield streams its one-time read (step+result for
the same shield key — UI overwrites the declined card) and adjudication
follows. On grant=false adjudication resolves from the three available
signals (never re-offers; declining is not evidence of risk). Low-stakes
no-consent runs skip the ask entirely and adjudicate from three signals.

ADJUDICATION event (last):
  data: {"type":"adjudication","decision":"step_up","risk_score":82,
         "step_up_method":"questions",
         "customer_message":"...","reasoning":"...","model":"llama3.1:8b"}
  model (v2.1, additive): dev-overlay metadata, as on RESULT events.

Headers: text/event-stream, Cache-Control: no-cache, X-Accel-Buffering: no.

## POST api/respond   (answers a consent_request; the stream then continues)
Req: {"run_id": str, "grant": bool}
Res: {"ok": true} · 404 unknown run · 409 already answered
Note: with the in-run consent_request flow, a TERMINAL adjudication of
step_up_method "temporary_biometric_permission" occurs only in the ?sync=1
fallback; the streaming path resolves consent before adjudicating.

## Shield LLM output contract (v2)
{"score": <int 0-100>, "confidence": "low"|"medium"|"high",
 "rationale": "<one sentence>",
 "steps": ["<short step taken>", ...]        // 1-4 items, plain English
}
Staged evaluation initial call (escalated path only) returns:
{"preliminary_score": <int>, "need_more": true|false, "step": "<one line>"}

## Adjudicator LLM output contract (v2)
{"decision": "allow"|"step_up"|"pause",
 "risk_score": <int 0-100>,
 "step_up_method": "questions"|"temporary_biometric_permission"|null,
 "customer_message": "<text>", "reasoning": "<one sentence>"}
step_up_method rules: "questions" = scam-interruption questions;
"temporary_biometric_permission" ONLY when a shield reported consent_declined and
the remaining signals are borderline. null when decision != step_up.
If consent.offer_declined=true: never return "temporary_biometric_permission"
again — resolve among allow / step_up "questions" / pause from the remaining
signals; declining the offer is NOT itself evidence of risk. (Server re-runs
adjudication only; shield results are unchanged.)

## Decision → screen routing
allow → success · step_up+questions → challenge screen (Continue re-POSTs with
challenge_passed=true → allow) · step_up+temporary_biometric_permission →
grant screen (Grant re-POSTs with consent {biometrics:true, temporary:true} →
full re-run) · pause → hold screen.

## Sentinel LLM contract (v2.2 — the on-device routing agent)
Called in a loop (cap 4 decisions). Input: transaction + transaction-domain
baseline + consent + escalated flag + optional device_hint (fixture field
"sentinel_hint") + evidence so far (score/confidence/rationale per completed
shield — same whitelist as the adjudicator) + remaining_shields.
Output: {"thinking": ["<line>", ...1-4], "invoke": ["<shield>", ...],
         "conclude": bool, "skip_note": "<line>"}
invoke ⊆ remaining_shields (server filters); empty invoke → conclude. On
conclude with shields remaining, each gets the skipped result above. Sentinel
transport/parse failure → fallback: ALL remaining shields run in parallel,
nothing skipped (pre-v2.2 behavior). Consent handling never moves into the
Sentinel: declined biometrics are removed from its routing set and the
platform owns the consent_request flow.

## Escalation trigger (server-side, deterministic)
escalated = amount > baseline.typical_txn_range_usd[1]
            OR transaction.payee_first_seen
            OR scenario has flag "escalate": true
Low-stakes → single full call, no mock-tool steps beyond "Loaded <slice>".
v2.2: escalated is also a Sentinel routing input; per-shield staging is
unchanged for whichever shields the Sentinel invokes.

## Payload slices (unchanged principle: scope isolation)
transaction → transaction+baseline · biometric → biometrics+baseline+consent ·
context → context+baseline · behavior → telemetry+baseline.
bot scenario: fixture telemetry_override REPLACES request telemetry.
Adjudicator → four results + transaction summary + consent flags.

## shields.json (display config — renames without code changes)
{"transaction": {"label": "Transaction Shield", "tagline": "..."} , ...}
