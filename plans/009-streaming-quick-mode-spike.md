# Plan 009: Spike — stream Quick Mode replies into the hero card

> **Executor instructions**: This is a **design/spike plan**, not a
> build-everything plan. Your deliverable is an investigation report plus a
> minimal prototype on a branch — NOT production code. Follow the steps,
> honor the STOP conditions, and write `plans/009-spike-report.md` with your
> findings and recommendation. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md`. This plan reads (does not modify) the
> worker files under `functions/` — if they look structurally different from
> what Step 1 describes, note it in the report and continue reading.

## Status

- **Priority**: P2
- **Effort**: L (spike: investigation + prototype + report)
- **Risk**: LOW (prototype only; no production code changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The Quick Mode redesign made the reply the hero of the results page — but the
user still waits 5–8s for the **entire** 5-tone × 3-variation JSON before
anything renders. The product's core promise (reply-first) is throttled by
generation-order: the output format template in the prompt emits
`extractedUnrepliedMessages` → `vibeCheck` → … → `suggestions` → `proTip` →
`recommendedAction`, so even a streamed JSON response would deliver the
suggestions **last**. The streaming plumbing already exists end-to-end for
Therapist mode: `runStreamWithFallback` in `services/geminiService.ts:140`
(NDJSON from the Cloudflare Worker's `/api/gemini/stream`, consumed at
`:1503-1569` with `{type:"metadata"}`, `{type:"text"}`, `{type:"functionCalls"}`
chunks). This spike determines whether — and how — Quick Mode can reuse it so
the first reply lands in ~1–2s.

## Current state

- `services/geminiService.ts:140` — `runStreamWithFallback(payload, modelChain)`
  POSTs to `/api/gemini/stream` with the same body shape as `runWithFallback`
  plus the Firebase bearer token; returns the raw `Response`.
- `services/geminiService.ts:1503-1569` — the NDJSON reader loop (Therapist
  path): buffers lines, `JSON.parse`s each, dispatches `metadata`/`text`/
  `functionCalls`/`error` chunk types, flushes the trailing buffer.
- `functions/api/gemini/stream.ts` and `functions/api/gemini/generate.ts` —
  the Worker endpoints (read both; the spike's Step 1 is summarizing their
  request contract and stream chunk emission).
- `services/geminiService.ts:583` — `getQuickAdvice` uses the non-streaming
  `runWithFallback` and assembles the full response via `normalizeQuickAdvice`
  (plan 003).
- `app/components/QuickModeScreen.tsx` — results render with a skeleton until
  `getQuickAdvice` resolves; the hero card animates in (plan 008 will have
  extracted it into `app/components/quick/ReplyHeroCard.tsx` if that landed).
- `services/quickAdvice.ts` (plan 003) — `normalizeQuickAdvice`,
  `buildQuickFallback`, `isQuickAdviceDegraded`, `buildCopyPayload`,
  `FALLBACK_PRO_TIP`; the spike's prototype should reuse these for the final
  assembly.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0               |
| Tests     | `bun test`         | all tests pass      |
| Build     | `npm run build`    | `✓ built in <n>s`   |

## Scope

**In scope** (files you may create/modify):
- `plans/009-spike-report.md` (create — the deliverable)
- A prototype branch `advisor/009-streaming-spike` with **experimental**
  changes clearly isolated (see Step 3). Prototype files may touch
  `services/geminiService.ts`, `app/components/QuickModeScreen.tsx` (or the
  extracted `ReplyHeroCard`), `functions/api/gemini/stream.ts` ONLY if a
  worker change is needed for the prototype — and must be reverted or clearly
  marked before the branch is handed back.

**Out of scope** (do NOT modify):
- Anything else, including `types.ts` (until the spike decides the contract),
  `services/quickAdvice.ts`, `services/feedbackService.ts`, `HistoryScreen.tsx`
- Production behavior: the prototype must be gated (feature-flag constant or
  env check) so the default app path is unchanged

## Git workflow

- Branch: `advisor/009-streaming-spike`
- Commit message style: `spike: prototype streamed quick mode replies`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Map the existing stream contract (investigation)

Read and summarize in the report:
1. `functions/api/gemini/stream.ts` — request body fields, auth, model chain
   handling, the exact chunk shape it emits per NDJSON line (types and fields),
   and any differences vs `generate.ts` (e.g. thinking config, `safetySettings`
   passthrough, retry semantics).
2. `services/geminiService.ts:1388-1583` — `streamTherapistAdvice`'s usage
   pattern (callbacks `onChunk`, `onNotesUpdate`, tool-call routing) as the
   template for a `streamQuickAdvice` shape.
3. Whether the Worker's stream path supports **function-call/thinking
   outputs** that would interfere with raw JSON streaming (Quick Mode sends no
   tools and no thinking config today — confirm the Worker does not add any).

**Verify**: the report contains a 10–20 line contract summary with file:line
citations. No code changes yet.

### Step 2: Decide the emission strategy (investigation + recommendation)

Evaluate these options against the evidence, and recommend one in the report:

- **A. Stream raw JSON, reorder the prompt output template** so `suggestions`
  comes first, and progressively render from a partial-JSON parser. Cheap
  client work; depends on the model emitting keys in template order (measure:
  does the existing non-streamed output respect template order? check a few
  saved sessions' key order in `HistoryScreen`/localStorage data if available).
- **B. Stream only the default tone's first option as plain text first**, then
  the full JSON behind it. Two-phase render: hero card streams like Therapist
  chat, full options land after. More client complexity (two assemblies) but
  no prompt-order dependency.
- **C. Two parallel calls**: fast non-streamed `generate` for the default tone
  (single tone, small prompt) + full `generate` for everything else. No worker
  changes; costs an extra model call; the "first text" latency is one round
  trip shorter, not token-streamed.

For each: estimated first-text latency, worker/prompt changes required, risk
to JSON reliability (partial-parse failures), and what breaks if the model
emits invalid JSON mid-stream.

**Verify**: the report has a comparison table and a single recommendation
with rationale.

### Step 3: Prototype the recommended option (gated, experimental)

Implement the minimal prototype of the recommendation on the spike branch:
- New service function (e.g. `streamQuickAdvice` in `geminiService.ts`) that
  wraps `runStreamWithFallback` and reports incremental chunks via a callback,
  following `streamTherapistAdvice`'s structure.
- A gated consumer: a module-level constant (e.g. `const QUICK_STREAM_ENABLED =
  import.meta.env.DEV === true && false;` — i.e. off by default) or an env
  check, so the production path is untouched. When enabled, the hero card
  renders streamed text into the reply bubble as chunks arrive.
- Reuse `services/quickAdvice.ts` for final assembly where possible.

Do NOT restructure state or persist anything. The prototype exists to answer:
does the stream deliver text early enough (measure: time-to-first-reply
characters), and does it hold together for the full JSON path?

**Verify**: `npm run typecheck`, `bun test`, `npm run build` all pass with the
prototype gated OFF (default path unchanged).

### Step 4: Write the report

Create `plans/009-spike-report.md` containing:
1. The stream contract summary (Step 1).
2. The strategy comparison + recommendation (Step 2).
3. Prototype results (Step 3): what worked, what broke, measured or observed
   time-to-first-text vs. current 5–8s full-wait, any Worker changes needed.
4. A concrete production plan sketch (files to touch, contract additions —
   e.g. whether `QuickAdviceResponse` needs a streaming variant, whether the
   prompt's output template must be reordered) sized S/M/L.
5. Open questions for the maintainer (e.g. should streaming apply to all
   tones or only the default; does the wait-state need to change the stream
   behavior; does the skeleton need to shrink to make room for early text).

**Verify**: the report exists and answers the five sections; it must NOT
contain secret values (API keys etc. — reference file:line + type only).

## Test plan

No production tests in a spike. Verification gates are the three commands
above (prototype off by default) plus the report's measured outcomes.

## Done criteria

All must hold:

- [ ] `plans/009-spike-report.md` exists with sections 1–5 from Step 4
- [ ] `npm run typecheck` exits 0
- [ ] `bun test` passes
- [ ] `npm run build` succeeds
- [ ] The prototype is gated OFF by default (`git diff` shows the gate constant)
- [ ] The report names the recommended strategy and lists open questions
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Worker's `stream.ts` cannot be read or differs fundamentally from a
  `/api/gemini/stream` NDJSON endpoint (the whole premise) — report what it
  actually is.
- Prototyping requires changing production code that cannot be gated — stop;
  a spike must not ship behavior changes.
- Streaming Quick Mode would require reworking `types.ts`/persisted sessions
  during the spike — that is a production decision; defer it to the report's
  open questions.

## Maintenance notes

- If the spike recommends option B (dual-phase), the follow-up plan will need
  `ReplyHeroCard` (plan 008) to accept a "streaming text" prop distinct from
  the final selected option — the extraction boundary from 008 already
  anticipates this.
- Whatever the recommendation, `services/quickAdvice.ts` remains the single
  assembly point — streaming must converge on `normalizeQuickAdvice` for the
  final state so degraded detection and copy payloads stay correct.
- The 12s "Give me a second…" toast in `handleAnalyze` is the current
  perceived-latency crutch; a streamed first reply should make it obsolete —
  note in the report whether it can be retired.
