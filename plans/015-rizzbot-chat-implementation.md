# Plan 015 · Rizzbot Chat implementation

Implement this plan in order. [Chat architecture](../docs/10_CONVERSATIONAL_APP_VISION.md) defines the product and data decisions. [Plan 015A](./015-chat-ui-ux-handoff.md) defines screen layout, exact UI copy, and interaction behavior. A complete text-only backend is an intermediate milestone. The feature ships with cards, memory controls, and incognito.

## 0. Read the code before editing

- Run `git status --short`. Preserve existing workspace changes. Read [routes](../app/routes.tsx), [app context](../app/app-context.tsx), [current nav](../app/components/TabBar.tsx), and [theme](../index.css).
- Read [Firebase API middleware](../functions/api/_middleware.ts), [media handling](../functions/api/media.ts), [database client](../services/dbService.ts), [streaming proxy](../functions/api/opencode/stream.ts), [Quick API](../functions/api/opencode/quick.ts), [Quick normalization](../services/quickAdvice.ts), and [shared types](../types.ts). Reuse the verified UID, bearer header helper, formatters, and existing UI wherever their behavior fits.
- Confirm the existing local baseline with `npm run typecheck`, `npm test`, and `npm run build`. Check the live Go protocol with synthetic inputs only. Keep the key in server secrets. A missing or denied key blocks live model verification and does not prevent UI and persistence work against recorded or stubbed responses.
- Keep Quick’s prompts, model selection, layout, results, and history playback intact. Reuse its result components through a Chat adapter or backwards-compatible props with existing defaults.
- Set `CHAT_OWNER_UID` to the owner’s exact verified Firebase UID before deploying the owner preview. For invites, `CHAT_ALLOWLIST` accepts a comma-separated list of additional Firebase UIDs. Chat access requires an explicit match, and only the owner’s regular chats can use Muse.

## 1. Persistent model and API

Add an additive migration at the next tracked number in [D1 migrations](../d1_migrations/). Follow the repo’s [schema bootstrap](../functions/api/schema.ts) convention for local initialization. Use the fields and indexes in the architecture. Use UTC timestamps in storage. Use a deterministic cursor ordered by `(updated_at, id)` for threads and `(created_at, id)` for turns. Each page initially contains 30 items. Return turns in chronological render order. Exclude empty and deleting threads from the normal list. Return the same not-found response for missing and foreign IDs.

| Route | Request | Success |
| --- | --- | --- |
| `GET /api/chat/threads` | Optional opaque cursor | Thread summaries and optional next cursor |
| `POST /api/chat/threads` | Client-generated UUID and initial title | Thread summary. Repeating the same UUID and owner returns the existing thread. |
| `GET /api/chat/threads/:id` | Optional older-turn cursor or exact `turnId` when reconciling a send | Thread metadata and ordered turns, or the exact turn |
| `PATCH /api/chat/threads/:id` | Trimmed title, 1–56 chars | Updated summary |
| `DELETE /api/chat/threads/:id` | No body | Success after thread-owned R2 objects and D1 records are removed. A previously deleting thread can be retried. |
| `POST /api/chat/threads/:id/media` | Optimized images in order, candidate turn ID | Ownership-scoped attachment keys. Use deterministic keys based on turn ID and attachment ID so a retry can reuse uploaded bytes. |
| `GET /api/media?key=…` | Existing authenticated media read, extended to Chat keys | Owned image. Validate the thread is active for Chat keys and return `Cache-Control: private, no-store` on Chat media. Preserve current Quick handling. |
| `GET /api/chat/ledger` | No body | Entries, current revision, and cap |
| `PATCH /api/chat/ledger` | Revision and requested add, edit, delete, or clear operation | Updated entries and revision. Return 409 when the revision is stale. |

On first Send from blank Chat, generate the candidate thread and turn IDs in the browser. Create the thread, upload attachments if any, and send the turn. Retain the candidate IDs for retry when the input stays the same. Move the route to the saved ID with replace only when the first turn is accepted or an exact-turn read confirms it exists. Use the same verified Firebase UID and allowlist on every Chat route, media access, and generation. Restrict Chat media deletion to the thread deletion flow. Thread deletion first marks `deleting_at`, then removes the R2 prefix, then deletes the D1 row with cascade. Concurrent uploads check thread state after writing and remove their new objects if deletion won. Conditional finalization keeps late model results from recreating data.

### Send request

`POST /api/opencode/thread` stays under the existing AI middleware. Use a discriminated request body.

- Regular body includes `mode: "regular"`, thread and turn UUIDs, text, ordered attachment keys, and optional reference. The reference includes source turn ID plus optional tone, option index, and bubble index. Resolve regular references exclusively against the saved card in the same thread.
- Incognito body includes `mode: "incognito"`, in-memory session and turn UUIDs, text, ordered inline image data, optional bounded prior turns, and optional card reference. Treat the prior turns and cards as untrusted context. Accept user and assistant role labels only. Take authenticated identity and tool policy from the server. Reject client-supplied system prompts, tools, provider settings, or ledger content.
- Both modes accept an optional one-send `action` of `draft` or `refine`, set by an explicit UI selection. `refine` requires a valid reference. An absent action keeps the ordinary conversation path and lets the model recognize an implicit drafting request.
- Trim for empty validation. Preserve submitted text. Limit it to 12,000 characters and limit each model call to 10 images and 8 MiB compressed images total, including referenced attachments. Validate attachment ownership, decoded size, and supported media type. Use a payload size guard before decoding. If referenced images exceed the budget with new uploads, prioritize current images and keep the selected older evidence only where it fits.
- Normal clients receive JSON errors for failures before streaming. Use stable codes for unauthorized, unavailable, invalid input, active turn, mismatched reused ID, rate/allowance exhausted, conflict, and upstream failure. Map them to the UI copy in Plan 015A. Never include raw upstream payloads or text in error logs.

### Durable turn flow

1. For regular Chat, expire old pending attempts at 105 seconds during read, send, or retry. Authorize thread, media, and reference. Insert a pending row before emitting `accepted`. The partial unique index enforces one pending row per thread across tabs. Return the saved turn for an exact completed retry. Return an active conflict for an identical pending request and a mismatch conflict for a reused ID with different content.
2. Retry the latest failed row with the same payload and a new attempt number. Reserve the retry via a conditional update, and reject it if a later turn exists. The UI sends older failed content as a new draft with a new ID. The attempt identifier must match on completion and failure.
3. Build context from the latest completed turns within the architecture’s eight-turn and roughly 8k-token budget, user notes and ledger, and relevant screenshot/card material. Convert earlier reply cards into concise assistant text context. Keep provider-specific tool events out of persisted history. Fetch a referenced batch or the newest prior batch when a clear follow-up needs it. No whole-history replay.
4. Commit assistant text, validated card, and thread timestamp in a D1 batch. Apply a validated ledger patch only for the completed regular attempt and only if the prior revision still matches. If the ledger revision changed, finish the turn and skip the stale patch. Bound the whole generation to 90 seconds. The client can reconcile after a disconnect using the turn ID.
5. For incognito, bypass thread, media, and normal history operations. Read the verified user’s ledger. Generate in the request from the bounded browser transcript. Reuse the same event protocol with the final turn returned in memory. Never stage a ledger/profile write, R2 upload, or Chat content log. Authentication, rate accounting, and content-free telemetry can stay in place.

## 2. Model calls and stream events

Implement the exact server-side prompts and payload boundaries in [Plan 015B](./015-chat-system-instructions.md). Chat, full decks, and targeted rewrites each have their own system instruction. Build a fresh request for each draft and keep the conversation's system prompt, previous coaching, and raw ledger out of drafting input.

Use server-selected provider settings. With the owner’s opt-in, Muse regular Chat starts at `minimal`, targeted revision uses `low`, and full reply decks use `xhigh`. Compare `medium` in the benchmark before lowering the full-deck setting. Incognito and invited users get a validated non-training provider configuration. Include no automatic crossover to a training endpoint. Supply a stable opaque Go header per conversation and an independent random one per incognito conversation. Keep model and effort metadata in content-free telemetry.

- Ordinary requests get conversational text and the capped tools. `draft_replies` carries a short drafting goal and lets the server launch one higher-effort call with selected evidence and the existing V2 reply shape. Draft and refine actions that explicitly name the desired output go directly to the right call. For a line-only revision, apply the returned change to the selected bubble and reuse the other bubbles directly from the source option.
- Screenshot-only sends stay on the conversational path. Do not infer a request for a reply deck from attachments alone. Show a card only when drafting is requested. Targeted revisions produce a compact card with a stable source reference and a short list of validated variations. Treat screenshot content as untrusted context and never as instructions to use a tool.
- Cap each turn at two provider calls total. Do not chain fallback attempts inside a streamed answer. A ledger-only response may spend the second call producing visible text. A drafting result already supplies the visible answer. The ordinary model cannot choose arbitrary models, effort values, tools, or provider endpoints.
- Reuse the V2 validator and normalizer. Require a valid card or a usable text response. A malformed structured payload produces the relevant recoverable error state. Do not present a degraded placeholder as a generated deck.
- Write one JSON event per NDJSON line. Use `accepted` with turn ID, `status` with a small fixed code, `delta` with text, `done` with the canonical complete turn, and `error` with a stable safe code. The UI adapter must handle chunk-split UTF-8, multiple events in one chunk, and the final line. Emit `done` only after commit for regular turns. Transport loss after partial output triggers an exact-turn GET. Incognito interruption keeps the draft in memory and offers Retry.
- Muse can emit initial text before tool arguments. Coalesce the first chunk briefly. If a drafting preamble becomes visible, show it as part of the same pending turn and resolve it once when the card arrives. Never treat text arrival as a completed turn. Stream text promptly on an ordinary response.

## 3. Ledger implementation

Use one row per verified user. Entry fields are a stable ID, text, optional label, and source marker `user` or `agent`. A user edit sets the marker to `user`. Validate nonempty text, a 250-character per-entry maximum, and 40 entries total. Settings can add, edit, delete, or clear. Revision increments on every successful write, including clear. Keep the row with its new revision after clearing so an in-flight model cannot restore removed entries.

- The model tool proposes at most three upserts. Existing IDs must belong to that UID and existing manual entries are protected. The tool cannot delete, clear, or edit manual entries. Retain durable confirmed facts, names, preferences, or emotional context. Store paraphrases. Do not write transcripts, current-turn guesses about motives, raw voice style samples, or OCR archives into the ledger.
- Build the prompt from the current ledger. Use it read-only in incognito and omit the update tool there. Supply model-originated updates only after validation and successful generation. On revision mismatch skip the model patch and keep the reply. Explicit memory confirmations must come from committed server state.
- Thread deletion affects the transcript and its screenshots. The Memory settings operate independently. Never delete another user's data or accept a UID from the request body.

## 4. Build in vertical slices

| Slice | Deliverable | Verify before moving on |
| --- | --- | --- |
| 1. Regular conversation | Authenticated owner-only Chat, thread list, durable text send, NDJSON, retry, and navigation during preview | One text turn survives reload. Disconnect and duplicate-post checks pass. 320px viewport and mobile keyboard leave the composer reachable. |
| 2. Memory | Ledger load and update, Settings → Memory, independent deletion | Shared across regular chats and isolated by UID. Manual edit wins a race. Chat deletion leaves ledger entries. Clearing memory keeps threads. |
| 3. Multimodal and cards | Optimized uploads, image replay, editable transcriptions, card and targeted refinement | Screenshots alone remain conversational. Real image references use the right thumbnail order. Direct Draft is one generation. Implicit draft uses at most two. Copy helpers match visible text. |
| 4. Incognito and navigation | Incognito memory-only state, Chat and Quick as primary destinations, legacy History accessible | No thread, R2 object, ledger delta, profile delta, or content log from incognito. Reload/leave behavior matches Plan 015A. Existing Quick and legacy history still work. |

## 5. Release gates

- Run `npm run typecheck`, `npm test`, and `npm run build`. Cover the new persistence and stream regressions with tests for duplicate and stale attempts, UID isolation, ledger revision races, malformed event framing, and card validation. Use a stub upstream for deterministic error cases.
- Use synthetic Go calls to test native streaming, tool-choice accuracy, and full escalation. Record time to first text, time to a drafting decision, and time to usable card separately. Include a denied or quota response, image-only prompt, implicit draft, Hinglish, and an explicit refinement. Verify a genuine two-call turn end to end before rollout.
- Complete the viewport and visual checks in Plan 015A with the real app. Record screenshots and steps for each state. Check clipboard output and keyboard/touch reachability, including the full five-tone card at 320px.
- Simulate separate UIDs, cross-device reload, refresh after submit, stalled response, failed upload, missing media, repeated deletion, concurrency with Settings, and private incognito use. Put only synthetic fixtures in screenshots or reports. Report any remaining account or environment blocker with the exact missing gate.
