# Refactoring Plans

Actionable, self-contained plans for fixing the architectural issues identified in the audit and executing the **Quick Mode Overhaul & App-Wide OpenCode Go Migration**. Each plan is written so an implementation agent in a fresh session can execute it start-to-finish without prior context.

## How to execute a plan

1. Read the plan file completely before making any changes.
2. Run the **Drift Check** command at the top of the plan first. If any target files changed since the anchor commit, inspect the diff before editing.
3. Follow the steps in order. Do not skip verification steps.
4. Run `npm run typecheck`, `npm test`, and `npm run build` at the points the plan specifies.
5. Check off every item in "Done criteria" before considering the plan complete.
6. Keep commits scoped to a single plan. Don't mix plans in one PR.

---

## Phase 1: Foundational Architecture & Cleanup (`001`–`009`)

| # | Plan | Priority | Effort | Depends on | Status |
|---|---|---|---|---|---|
| [001](./001-Delete-Dead-Duplicate-Files.md) | Delete dead duplicate files (`hooks/`, `utils/`, `components/Toast.tsx`) | P0 | 15 min | — | DONE |
| [002](./002-Secure-Legacy-UID-Migration.md) | Fix unauthenticated data-claim vulnerability in `/api/migrate` | P0 | 45 min | — | DONE |
| [003](./003-Consolidate-D1-Schema-And-Migrations.md) | Single source of truth for D1 schema; run migrations once per isolate | P0 | 2–3 hr | 002 | DONE |
| [004](./004-Decompose-App-Monolith-And-Add-Router.md) | Split `App.tsx` (3,037 LOC) into per-mode screens + add URL routing | P1 | 1–2 days | 001 | DONE |
| [005](./005-Tighten-TypeScript-And-Fix-Any.md) | Remove `@ts-nocheck`, eliminate `any`, enable `strict: true` | P1 | 1 day | 004 | DONE |
| [006](./006-Service-Layer-For-People-API.md) | Route `/api/people` calls through `dbService` instead of raw `fetch` in components | P2 | 2 hr | 004 | DONE |
| [007](./007-Centralize-Practice-Streaks-In-D1.md) | Move practice streaks from `localStorage` into D1 (`user_stats` table) | P2 | 3 hr | 003, 004 | DONE |
| [008](./008-Unify-Styling-Tailwind-And-Design-Tokens.md) | Replace inline `style={{}}` objects with Tailwind classes backed by CSS tokens | P2 | 1 day | 004 | DONE |
| [009](./009-Verify-And-Wire-Learned-Preferences-Loop.md) | Verify `feedback_signals` → `learned_preferences` closed loop with tests | P1 | 3–4 hr | 003, 005 | DONE |

---

## Phase 2: Quick Mode Overhaul, Passive Voice Learning & App-Wide Gemini Eradication (`010`–`014`)

> **Environment Prerequisites for Plans `010`–`014`**:
> - **Cloudflare Secret / `.dev.vars`**: `OPENCODE_GO_API_KEY` must be configured in Cloudflare Pages secrets (`npx wrangler pages secret put OPENCODE_GO_API_KEY`) and in local `.dev.vars` for local dev. **Never commit raw API keys to any file.**
> - **Cloudflare R2 Bucket (Plan 011)**: Create the `rizzbot-media` R2 bucket (`npx wrangler r2 bucket create rizzbot-media`), bound as `RIZZBOT_MEDIA` in `wrangler.toml`.
> - **Future Phase Blueprint**: See [docs/10_CONVERSATIONAL_APP_VISION.md](../docs/10_CONVERSATIONAL_APP_VISION.md) for the Phase 2 unified conversational thread architecture that builds directly on Plans `010`–`014`.

| # | Plan | Priority | Effort | Depends on | Status |
|---|---|---|---|---|---|
| [010](./010-quick-mode-opencode-si-v4.md) | Quick Mode OpenCode Go Backend (`muse-spark-1.3-contributor:xhigh` → `deepseek-v4.1-flash:high` → `hy4-flash-free:high`), System Instruction v4.1 & 5-Tab Multi-Bubble Schema | P0 | 3–4 hr | 009 | DONE (adapted: V2 additive with V1 bridge, getFirebaseToken, real UserStyleProfile fields) |
| [011](./011-quick-mode-r2-media-10-shots.md) | Quick Mode Cloudflare R2 Media Storage (`RIZZBOT_MEDIA`), 10-Screenshot WebP Pipeline (`1280px` @ `0.80`) & `<R2Image />` | P0 | 3–4 hr | 010 | DONE (adapted: result-JSON R2 keys, useSessionState quota-safe, history via R2Image) |
| [012](./012-quick-mode-ux-overhaul.md) | Quick Mode Input & Results UX Overhaul (Multi-Bubble `ReplyHeroCard`, `FriendSummaryCard`, Dynamic Goal Label, Calm Loading & History Parity) | P0 | 4–5 hr | 010, 011 | DONE (ReadStrip deleted, Real/Smooth/Playful/Bold/Your Style, bottom-[60px] bar + ThumbsDown) |
| [013](./013-passive-voice-learning-and-quiz-fix.md) | Passive Voice Learning from Quick Mode Screenshots (`/api/voice/learn`), D1 Migration `007` & `MyVoiceScreen` Quiz Fix | P1 | 3–4 hr | 010, 012 | DONE (quiz signaturePatterns/rawSamples emptied, learned_samples/cadence_notes persisted) |
| [014](./014-eradicate-gemini-appwide.md) | Eradicate Gemini App-Wide (100% OpenCode Go Migration for Therapist SSE + 11 Tools, Practice, Style Extraction & WAV Voice Transcription; remove `@google/genai`) | P0 | 5–6 hr | 010, 011, 012, 013 | DONE (aiService + opencode/generate|stream, mimo transcribe, zero grep, no genai chunk) |

### Recommended execution order for `010`–`014`

```text
010 (OpenCode Go Quick proxy + SI v4.1 + V2 bubble schema)
 └──► 011 (Cloudflare R2 media bucket + 10-screenshot WebP pipeline + R2Image)
       └──► 012 (Quick Mode V2 input & results UX overhaul + History replay parity)
             └──► 013 (Passive voice learning from screenshots + MyVoiceScreen quiz fix)
                   └──► 014 (App-wide Gemini eradication: Therapist, Practice, Voice, remove @google/genai)
```

Execute `010` → `011` → `012` → `013` → `014` sequentially so every commit passes `npm run typecheck`, `npm test`, and `npm run build` with zero broken intermediate states.
