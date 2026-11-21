# Plan 016 — Muse Everywhere, Remove `CHAT_OWNER_UID` Gate, DeepSeek Strictly for Incognito & Fallbacks

> **Before you start — drift check.** This plan was written against commit `bdde2ab` (`main`). Before touching anything, run:
>
> ```bash
> git log --oneline bdde2ab..HEAD -- functions/api/opencode/thread.ts functions/api/opencode/stream.ts functions/lib/chatStore.ts functions/lib/chatEngine.test.ts
> ```
>
> If any of those files changed since `bdde2ab`, **STOP and read the diff** before applying edits. All file paths and line numbers below are verified against `bdde2ab`.

## Status

- **Priority**: P0 (unblocks Muse Spark 1.3 + `think_deeper` escalation for all users and removes the unnecessary `CHAT_OWNER_UID` training/privacy fence)
- **Effort**: ~1–1.5 hours
- **Depends on**: `bdde2ab` (Chat v1 + `think_deeper` + `high`-default decks)
- **Risk**: Low (simplifies model routing and removes dead owner-only branching)

---

## Why this matters

In `bdde2ab`, `functions/api/opencode/thread.ts` fenced `muse-spark-1.3-contributor` and `think_deeper` behind `isChatOwner(env, uid)` (`env.CHAT_OWNER_UID === uid`) because Muse's contributor tier has `training: true`.

The product owner explicitly decided:
1. **Training data on texting chats is completely fine** for regular usage — there is no reason to gate Muse behind `CHAT_OWNER_UID`.
2. **Every regular feature and every regular user** (not just the owner) must run on **`muse-spark-1.3-contributor`** as Primary:
   - Regular Chat (`thread.ts`): `muse-spark-1.3-contributor` (`minimal` default → `think_deeper` `medium | high | xhigh` for **all** regular users; `high` default decks → `xhigh` on high-stakes; `medium` revisions).
   - Quick Mode (`quick.ts`): already `muse-spark-1.3-contributor` (`xhigh`).
   - Practice / Style / Closure (`generate.ts`): already `muse-spark-1.3-contributor` (`medium`/`low`).
   - Passive Voice Learning (`voice/learn.ts`): already `muse-spark-1.3-contributor` (`low`).
   - Legacy Therapist Stream (`stream.ts`): currently still has `deepseek-v4.1-flash` as Primary (`stream.ts:95`) — **must also switch to `muse-spark-1.3-contributor` (`medium`) as Primary!**
3. **`deepseek-v4.1-flash` (`zdr: true`) is reserved strictly for TWO roles**:
   - **Incognito Chat (`mode === "incognito"`)**: Zero-data-retention privacy mode (`chat: none` for ~1.4s TTFT, `draftFull: high`, `draftRev: high`), falling back to `hy4-flash-free:high`.
   - **Error / Allowance Fallback #1** behind `muse-spark-1.3-contributor` across all regular endpoints (`Muse → DeepSeek:high → Hy4-Flash-Free:high`).

---

## Current state (verified at `bdde2ab`)

1. **`functions/api/opencode/thread.ts:25, 56-70, 660-755`**:
   - `pickModels(env, uid, mode)` (`lines 56-70`) checks `if (mode === "incognito" || !isChatOwner(env, uid))` and routes all non-owner users to `deepseek-v4.1-flash`.
   - `const allowThink = isChatOwner(env, uid);` (`line 660`) disables `THINK_DEEPER_TOOL` and `think_deeper` escalation (`lines 672, 698, 724`) for all non-owner users (and breaks for everyone if `CHAT_OWNER_UID` is unset in Cloudflare env).
   - `chatCandidates` (`lines 661-663`) only includes `DEEPSEEK_ID` as fallback for owner, omitting `HY4_ID` as final free fallback.
   - Inside `think_deeper` (`line 743`), if Call 1 emitted a brief preamble without trailing whitespace, Call 2's first delta is concatenated directly onto `assistantText` without a `\n\n` separator.
2. **`functions/lib/chatStore.ts:22-30`**:
   - `isChatOwner(env, uid)` checks `env.CHAT_OWNER_UID?.trim() === uid`.
   - `checkChatAllowlist(env, uid)` returns `false` when `CHAT_OWNER_UID` and `CHAT_ALLOWLIST` are both unset — locking all signed-in users out of Chat (`403`) unless manually allowlisted!
3. **`functions/api/opencode/stream.ts:94-121`**:
   - `chain` starts with `deepseek-v4.1-flash` instead of `muse-spark-1.3-contributor`.
4. **`functions/lib/chatEngine.test.ts:18-28`**:
   - Unit tests assert `isChatOwner` and `checkChatAllowlist({}, "OwnerUid") === false`.

---

## Scope

### Files to modify
1. `functions/lib/chatStore.ts` — Remove `isChatOwner` and `CHAT_OWNER_UID`. Update `checkChatAllowlist(env, uid)` so that when `CHAT_ALLOWLIST` is empty/unset, **all authenticated Firebase users (`Boolean(uid)`) are allowed**; when `CHAT_ALLOWLIST` is explicitly populated (comma-separated UIDs), restrict to that list.
2. `functions/api/opencode/thread.ts` —
   - Remove `isChatOwner` import and all `CHAT_OWNER_UID` / `allowThink` owner gating.
   - Simplify `pickModels(mode: Mode)` so **only** `mode === "incognito"` selects DeepSeek (`none`/`high`/`high`); `mode === "regular"` **always** selects `muse-spark-1.3-contributor` (`minimal` chat, `high` default decks → `xhigh` high-stakes, `medium` revisions).
   - Enable `THINK_DEEPER_TOOL` and `think_deeper` escalation (`medium | high | xhigh`) for **all regular Chat users**.
   - Ensure fallback chains are consistent:
     - Regular chat & `think_deeper`: `[{ model: SPARK_ID, effort }, { model: DEEPSEEK_ID, effort: "high" }, { model: HY4_ID, effort: "high" }]`.
     - Regular drafts (`full` & `revision`): `[{ model: SPARK_ID, effort }, { model: DEEPSEEK_ID, effort: "high" }, { model: HY4_ID, effort: "high" }]`.
     - Incognito chat: `[{ model: DEEPSEEK_ID, effort: "none" }, { model: HY4_ID, effort: "high" }]`.
     - Incognito drafts: `[{ model: DEEPSEEK_ID, effort: "high" }, { model: HY4_ID, effort: "high" }]`.
   - Add a clean `\n\n` separator before Call 2's first delta in `think_deeper` if Call 1 already streamed non-empty `assistantText` that does not end with whitespace.
3. `functions/api/opencode/stream.ts` — Switch Therapist streaming primary to `muse-spark-1.3-contributor` (`medium`) via `/v1/responses` (with streaming `response.output_text.delta` + `response.completed` `function_call` handling, matching `thread.ts`), falling back to `deepseek-v4.1-flash` (`high`) → `hy4-flash-free` (`high`) via `/v1/chat/completions`.
4. `functions/lib/chatEngine.test.ts` — Remove `isChatOwner` test assertions, update `checkChatAllowlist` tests (open to all authenticated users when `CHAT_ALLOWLIST` is unset; strict match when `CHAT_ALLOWLIST` is set), and add a test for `pickModels` (exported from `chatEngine.ts` or `thread.ts`) proving `"regular"` always picks `muse-spark-1.3-contributor` and `"incognito"` always picks `deepseek-v4.1-flash`.

---

## Step-by-Step Implementation Instructions

### Step 1: Remove `CHAT_OWNER_UID` & `isChatOwner` in `functions/lib/chatStore.ts:22-30`

Replace lines 22–30 of `functions/lib/chatStore.ts` with:

```ts
/**
 * Optional beta allowlist gate.
 * - If CHAT_ALLOWLIST is unset/blank: all authenticated Firebase users are allowed.
 * - If CHAT_ALLOWLIST is set (comma-separated UIDs): only listed UIDs are allowed.
 */
export function checkChatAllowlist(env: { CHAT_ALLOWLIST?: string }, uid: string): boolean {
  if (!uid) return false;
  const raw = (env.CHAT_ALLOWLIST ?? "").trim();
  if (!raw) return true;
  return raw.split(",").some((entry) => entry.trim() === uid);
}
```

---

### Step 2: Update `functions/api/opencode/thread.ts`

1. **Remove `isChatOwner` from the import block (`line 25`)**.
2. **Replace `pickModels` (`lines 56-70`)** (and export it so unit tests can lock it down):
   ```ts
   export function pickModels(mode: Mode): {
     chat: { id: string; effort: string };
     draftFull: { id: string; effort: string };
     draftRev: { id: string; effort: string };
   } {
     if (mode === "incognito") {
       return {
         // Incognito ZDR privacy path: non-thinking chat (probe-verified 1.4s TTFT) + high-effort drafts.
         chat: { id: DEEPSEEK_ID, effort: "none" },
         draftFull: { id: DEEPSEEK_ID, effort: "high" },
         draftRev: { id: DEEPSEEK_ID, effort: "high" },
       };
     }
     // Regular Chat (ALL users): Muse Spark 1.3 across all rungs; DeepSeek & Hy4 are fallback-only.
     return {
       chat: { id: SPARK_ID, effort: "minimal" },
       draftFull: { id: SPARK_ID, effort: "high" },
       draftRev: { id: SPARK_ID, effort: "medium" },
     };
   }
   ```
   *(Move `SPARK_ID`, `DEEPSEEK_ID`, `HY4_ID` constants above `pickModels` so they are in scope.)*
3. **Update call sites of `pickModels`**:
   - Line 601: `const models = pickModels("regular");`
   - Line 982 (incognito): `const models = pickModels("incognito");`
4. **Enable `think_deeper` & 3-tier fallback for ALL regular users (`lines 660-755`)**:
   - Delete `const allowThink = isChatOwner(env, uid);`.
   - Set:
     ```ts
     const chatCandidates: ModelCandidate[] = [
       { model: models.chat.id, effort: models.chat.effort },
       { model: DEEPSEEK_ID, effort: "high" },
       { model: HY4_ID, effort: "high" },
     ];
     ```
   - Always pass `tools: [DRAFT_REPLIES_TOOL, UPDATE_LEDGER_TOOL, THINK_DEEPER_TOOL]` on regular turns (`line 672`).
   - Change `if (thinkCall && allowThink)` on lines 698 and 724 to `if (thinkCall)`.
   - Inside `if (thinkCall)` (`lines 736-745`), add `HY4_ID` to the fallback list and guard preamble separation:
     ```ts
     let firstDeeperDelta = true;
     const cont = await callConversationalStream({
       apiKey,
       sessionTag: `${sessionBase}-deeper`,
       candidates: [
         { model: SPARK_ID, effort: tier },
         { model: DEEPSEEK_ID, effort: "high" },
         { model: HY4_ID, effort: "high" },
       ],
       system: CHAT_SI_V1,
       messages: [
         ...openAiMessages,
         { role: "assistant", content: assistantText || "(thinking it through — now answer directly)" },
       ],
       signal: turnAbort.signal,
       onText: async (t) => {
         if (firstDeeperDelta && assistantText.trim() && !/\s$/.test(assistantText) && !/^\s/.test(t)) {
           assistantText += "\n\n";
           await send({ type: "delta", text: "\n\n" });
         }
         firstDeeperDelta = false;
         assistantText += t;
         await send({ type: "delta", text: t });
       },
     });
     ```
5. **Verify incognito fallback chain (`handleIncognito`, lines 982–1065)**:
   - Incognito chat candidates: `[{ model: DEEPSEEK_ID, effort: "none" }, { model: HY4_ID, effort: "high" }]`.
   - Incognito draft candidates: `[{ model: DEEPSEEK_ID, effort: "high" }, { model: HY4_ID, effort: "high" }]`.
   - Never include `SPARK_ID` in incognito candidates so Incognito remains strictly ZDR (`zdr: true`).

---

### Step 3: Switch Therapist Stream (`functions/api/opencode/stream.ts`) to Muse Primary

In `functions/api/opencode/stream.ts:94-195`:
1. Update the model chain to:
   ```ts
   const chain = [
     { id: "muse-spark-1.3-contributor", format: "responses" as const, effort: "medium", timeoutMs: 90_000 },
     { id: "deepseek-v4.1-flash", format: "chat" as const, effort: "high", timeoutMs: 90_000 },
     { id: "hy4-flash-free", format: "chat" as const, effort: "high", timeoutMs: 90_000 },
   ];
   ```
2. When `spec.format === "responses"`, send to `https://opencode.ai/inference/go/openai/v1/responses` with:
   - `model: spec.id`
   - `instructions: systemInstruction || ""`
   - `reasoning: { effort: spec.effort }`
   - `stream: true`
   - `input`: converted `messages` (`input_image` / `input_text`)
   - `tools`: `openAITools.map(({ type, function: fn }) => ({ type, ...fn, strict: false }))` (when `openAITools.length > 0`)
   - Parse `response.output_text.delta` → `await send({ type: "text", content: evt.delta })`, and `response.completed` → collect `item.type === "function_call"` into `await send({ type: "functionCalls", calls })` (identical to the verified Responses SSE parser already working in `thread.ts:214-223`!).
3. When `spec.format === "chat"`, keep the existing `/v1/chat/completions` fallback path for `deepseek-v4.1-flash` and `hy4-flash-free`.
4. Add a 10s `ping` heartbeat (`{ type: "ping" }`) to `stream.ts` (note: `services/aiService.ts:283` ignores unknown chunk types safely).

---

### Step 4: Update Unit Tests (`functions/lib/chatEngine.test.ts`)

1. Remove `isChatOwner` from the import on line 18.
2. Update the allowlist test (`lines 20-28`):
   - `expect(checkChatAllowlist({}, "anySignedInUid")).toBe(true);`
   - `expect(checkChatAllowlist({ CHAT_ALLOWLIST: "" }, "anySignedInUid")).toBe(true);`
   - `expect(checkChatAllowlist({}, "")).toBe(false);`
   - `expect(checkChatAllowlist({ CHAT_ALLOWLIST: "guestUid, secondUid" }, "guestUid")).toBe(true);`
   - `expect(checkChatAllowlist({ CHAT_ALLOWLIST: "guestUid, secondUid" }, "otherUid")).toBe(false);`
3. Add a `pickModels` test verifying:
   - `pickModels("regular")` returns `muse-spark-1.3-contributor` for `chat` (`minimal`), `draftFull` (`high`), and `draftRev` (`medium`).
   - `pickModels("incognito")` returns `deepseek-v4.1-flash` for `chat` (`none`), `draftFull` (`high`), and `draftRev` (`high`).

---

## Test Plan

1. **Zero `CHAT_OWNER_UID` / `isChatOwner` grep**:
   ```bash
   git grep -n -E "isChatOwner|CHAT_OWNER_UID" -- functions/ services/ app/
   ```
   Must return **0 matches**.
2. **Typecheck, Unit Tests & Build**:
   ```bash
   npm run typecheck && npm test && npm run build
   ```
   All must exit `0` with all tests passing.

---

## Done Criteria

- [ ] `isChatOwner` and `CHAT_OWNER_UID` are completely removed from `functions/lib/chatStore.ts`, `functions/api/opencode/thread.ts`, and `functions/lib/chatEngine.test.ts`.
- [ ] `checkChatAllowlist` allows all authenticated Firebase users when `CHAT_ALLOWLIST` is unset, and restricts only when `CHAT_ALLOWLIST` is explicitly configured.
- [ ] `pickModels("regular")` uses `muse-spark-1.3-contributor` for **all** regular Chat users (`minimal` chat → `think_deeper` `medium | high | xhigh`, `high` default decks → `xhigh` high-stakes, `medium` revisions) with `deepseek-v4.1-flash:high` → `hy4-flash-free:high` as error fallbacks.
- [ ] `pickModels("incognito")` uses `deepseek-v4.1-flash` (`none` chat, `high` drafts) → `hy4-flash-free:high` (never Muse).
- [ ] `functions/api/opencode/stream.ts` (Therapist mode) uses `muse-spark-1.3-contributor` (`medium`) as Primary, with `deepseek-v4.1-flash:high` → `hy4-flash-free:high` as error fallbacks.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` all exit 0.

---

## STOP Conditions

- **STOP** if `isChatOwner` or `CHAT_OWNER_UID` still exists anywhere in `functions/`, `services/`, or `app/`.
- **STOP** if `muse-spark-1.3-contributor` is included in any `mode === "incognito"` candidate list (Incognito must remain ZDR-only: DeepSeek → Hy4).
