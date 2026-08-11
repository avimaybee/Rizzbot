# Plan 009 — Spike Report: Streaming Quick Mode replies

**Status**: DONE — report written; gated prototype landed on the main working
tree (off by default); runtime latency measurement NOT performed (no API
credentials / dev-server auth in the executor environment).

---

## 1. Stream contract summary (verified by reading the code)

**Worker endpoint** `functions/api/gemini/stream.ts` (180 lines):
- POST only; body: `{ modelChain, contents, systemInstruction, tools, safetySettings, config }` (`stream.ts:29-30`).
- Response: `application/x-ndjson` streaming body (`stream.ts:10`), one JSON object per line.
- Chunk types emitted (`stream.ts:96-161`):
  - `{ type: "metadata", model: string }` — emitted once, on first token
  - `{ type: "text", content: string }` — incremental text deltas
  - `{ type: "functionCalls", calls: [...] }` — only when tools are used (Quick Mode sends none)
  - `{ type: "error", message, status? }` — terminal error; also sent when ALL fallback models fail
- Model fallback loop + tool-call round loop on the worker; the client sees a single stream.
- **Critical finding**: if the client does NOT pass `config.thinkingConfig`, the worker forces it — `thinkingLevel: "HIGH"` for `gemini-3*` models, `thinkingBudget: 4096` for `gemini-2.5*` (`stream.ts:58-64`). High thinking delays first output token (the entire point of streaming is defeated) and can alter JSON formatting. Any Quick Mode stream MUST pass `config.thinkingConfig` explicitly — the therapist path already does (`geminiService.ts:1500`), and the prototype follows it.
- CORS: `Access-Control-Allow-Origin: *` with `Authorization` header allowed (no credentials mode; Firebase bearer is not a cookie, so this is acceptable).

**Client plumbing** `services/geminiService.ts`:
- `runStreamWithFallback` (line ~140) POSTs to `/api/gemini/stream` with the Firebase bearer token, retries 503s, returns the raw `Response`.
- `streamTherapistAdvice` (line ~1388) is the proven consumption pattern: buffered line-split → `JSON.parse` per line → `{type:"error"}` throws → `{type:"text"}` accumulates + `onChunk(text)` → trailing-buffer flush (`geminiService.ts:1503-1569`).
- `getQuickAdvice` (line ~583) uses the non-streaming `/api/gemini/generate`; its full prompt + parts assembly was extracted into `buildQuickAdviceParts` (line 585) during this spike so the streaming path sends a byte-identical payload.

## 2. Strategy comparison

| Option | First-text latency | Worker changes | Prompt changes | JSON reliability risk | Effort |
|---|---|---|---|---|---|
| **A. Reorder output template + tolerant partial-JSON render** | ~1–2s (LOW thinking) | none | reorder `OUTPUT FORMAT` keys (suggestions first) | MED — depends on model honoring key order; partial-parse failures need a tolerant parser | M–L |
| **B′. Stream full JSON, render raw-text preview, assemble on completion** *(prototype)* | ~1–2s (LOW thinking) | none | none | LOW — assembly uses the existing `normalizeQuickAdvice` on the complete JSON; preview is best-effort | S–M |
| **C. Two parallel calls (fast default-tone + full)** | one RTT (not token-streamed) | none | new single-tone prompt | LOW | M |

**Recommendation: B′** (the prototype's shape). It reuses the proven
Therapist NDJSON plumbing end-to-end with zero worker changes, keeps the
existing JSON contract and `normalizeQuickAdvice` assembly (so degraded
detection and copy payloads stay correct), and delivers the product win —
reply text on screen in ~1–2s instead of 5–8s — with a best-effort preview
that costs nothing if the model stream is slow to start. A (prompt reorder +
progressive JSON render) is the follow-up that turns the preview from raw text
into the styled reply bubble; validate model key-order fidelity before
committing to it. C costs an extra model call and gains only one RTT — not
worth it.

## 3. Prototype results

Landed, gated OFF (`QUICK_STREAM_ENABLED = false`, `app/components/QuickModeScreen.tsx:39`):
- `services/geminiService.ts:918` — `streamQuickAdvice(request, onChunk)`: `buildQuickAdviceParts` + `safetySettings` + `config: { thinkingConfig: { thinkingLevel: "LOW" } }`, the Therapist NDJSON reader loop verbatim, final assembly `safeParseJson` → `normalizeQuickAdvice`; throws on stream error.
- `app/components/QuickModeScreen.tsx` — `streamedText` state fed by `onChunk`; used only when the gate is true; reset on analyze/redo/edit.
- `app/components/quick/ReplyHeroCard.tsx` — optional `streamedText` prop renders raw streamed text in the hero while streaming; falls back to the normal selected-option UI otherwise.
- `getQuickAdvice` refactored to delegate parts building to `buildQuickAdviceParts` — production payload byte-identical.
- Gates: `npm run typecheck` exit 0 · `bun test` 26 pass · `npm run build` ✓ · gate off by default.

**Not measured**: runtime first-text latency and streamed-JSON reliability
require a live API key + authenticated dev session, unavailable here. The
static evidence (proven therapist reader, LOW thinking override) suggests
~1–2s first text; this must be validated on-device before rollout.

## 4. Production plan sketch (if approved)

- **Sized M**: enable path, preview UI, fallback, rollout flag.
  1. Replace the hardcoded gate with a runtime flag (e.g. localStorage `quick_stream=1` or env), default OFF.
  2. **Mandatory fallback**: if `streamQuickAdvice` throws mid-stream, call the existing `getQuickAdvice` path and swap in the full result (user-visible cost: brief skeleton; never a stuck half-JSON).
  3. Make the preview meaningful: reorder the `OUTPUT FORMAT` template so `suggestions` precedes `vibeCheck`/`detectedMeta` (test key-order fidelity on 10 sample runs first); render progressively-parsed default-tone replies into the styled bubble instead of raw text.
  4. Trim the skeleton's reserved height so early text doesn't shift the layout; keep the 12s patience toast only as a no-first-token timeout.
  5. Validate JSON reliability with LOW thinking on `gemini-3.5-flash-lite` (10–20 runs) before flipping the flag.
- **Sized S (interim MVP)**: keep the current raw-text preview behind the flag, ship the fallback (item 2), measure, then invest in item 3.

## 5. Open questions for the maintainer

1. **LOW thinking vs structured-output reliability**: the worker forces HIGH thinking on `gemini-3*` unless overridden; LOW speeds first text but may raise malformed-JSON rate. Is the flash-lite JSON failure rate at LOW thinking acceptable? (Measure before rollout.)
2. **Preview UX**: raw streamed JSON text (quotes, keys) in the hero is interim-ugly. Accept raw preview for v1 of the flag, or gate the preview and only reveal on complete assembly (then the win is purely "skeleton → answer sooner")?
3. **Wait-state race**: `suggestions.wait` arrives at the end of the JSON. With streaming, the user sees reply text before the "don't reply yet" advisory lands. Suppress the preview until the wait key parses, or accept the transient?
4. **Per-tone streaming**: stream only the default tone's text early (as originally scoped), or the full JSON (prototype's shape)? Prototype chose full JSON — simpler, still reply-first.
5. **12s patience toast**: retire once first-text streaming is proven, or keep as a stall guard?
6. **Non-streaming parity**: confirm `/api/gemini/generate` (`functions/api/gemini/generate.ts`) does NOT force HIGH thinking today (not read in this spike) — if it does, the current 5–8s wait already includes thinking time, which changes the perceived-speed math for the flag.
