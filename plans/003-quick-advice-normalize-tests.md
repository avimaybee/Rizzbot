# Plan 003: Extract pure quick-advice module + characterization tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md`, and verify the excerpts in "Current
> state" match `services/geminiService.ts` (the `normalize`/fallback region)
> and `app/components/QuickModeScreen.tsx:155-162`. On a mismatch, STOP and
> report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 001 (clean tsc baseline + `bun test` gate)
- **Category**: tests
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The entire Quick Mode rework is defined by pure logic that has **zero test
coverage** and is embedded in a file that can't be unit-tested as-is: the
roast→bold merge in `normalize()`, the vibe defaults, the fallback shape, the
degraded-response heuristic, and the copy payload assembly all live inside
`getQuickAdvice` or `QuickModeScreen`, and `geminiService.ts` imports Firebase
(`getFirebaseToken`) so importing it under `bun test` drags in side effects.
This plan extracts that logic into a dependency-free module and pins its
behavior with characterization tests, so the tone merge (the whole point of
the rework) and everything downstream of it (plans 002, 004, 007, 008) can be
changed safely.

## Current state

`services/geminiService.ts` — inside `getQuickAdvice`, the response assembly
(immediately after `const parsed = safeParseJson<QuickAdviceResponse>(text);`):

```ts
    const normalize = (list: any): SuggestionOption[] =>
      Array.isArray(list) ? list.filter((o: any) => o && Array.isArray(o.replies) && o.replies.length > 0) : [];
    return {
      ...parsed,
      vibeCheck: parsed.vibeCheck || {
        theirEnergy: 'neutral',
        interestLevel: 50,
        redFlags: [],
        greenFlags: []
      },
      suggestions: {
        smooth: normalize(parsed.suggestions?.smooth),
        bold: normalize(parsed.suggestions?.bold).length > 0
          ? normalize(parsed.suggestions?.bold)
          : normalize((parsed.suggestions as any)?.roast), // legacy roast data folds into bold
        witty: normalize(parsed.suggestions?.witty),
        authentic: normalize(parsed.suggestions?.authentic),
        yourStyle: normalize(parsed.suggestions?.yourStyle),
        wait: parsed.suggestions?.wait ?? null,
      },
      proTip: parsed.proTip || "ngl couldn't read that one properly, try again",
      recommendedAction: parsed.recommendedAction || 'MATCH',
    };
```

And the catch-path fallback in the same function:

```ts
    const fallbackOption = {
      replies: [{ originalMessage: "their message", reply: "hey" }],
      conversationHook: "whats good"
    };
    return {
      vibeCheck: { theirEnergy: 'neutral', interestLevel: 50, redFlags: [], greenFlags: [] },
      suggestions: {
        smooth: [fallbackOption, fallbackOption, fallbackOption],
        bold: [fallbackOption, fallbackOption, fallbackOption],
        witty: [fallbackOption, fallbackOption, fallbackOption],
        authentic: [fallbackOption, fallbackOption, fallbackOption],
        yourStyle: [fallbackOption, fallbackOption, fallbackOption],
        wait: undefined
      },
      proTip: "ngl couldn't read that one properly, try again",
      recommendedAction: 'MATCH'
    };
```

`app/components/QuickModeScreen.tsx` lines 155–162 — the degraded heuristic:

```ts
  const isDegraded = useMemo(() => {
    if (!result) return false;
    if (result.proTip === "ngl couldn't read that one properly, try again") return true;
    const first = result.suggestions.smooth?.[0]?.replies?.[0]?.reply;
    return first === "hey";
  }, [result]);
```

`app/components/QuickModeScreen.tsx` lines 381–386 — the copy payload assembly
(see plan 002):

```ts
  const handleCopyAll = async () => {
    if (!selectedOption) return;
    const replies = selectedOption.replies.map((r) => r.reply).filter(Boolean).join("\n\n");
    const hook = selectedOption.conversationHook ? `\n\n${selectedOption.conversationHook}` : "";
    await handleCopy(`${replies}${hook}`, `copyall-${activeTone}-${cursor[activeTone]}`);
  };
```

Test conventions — `services/feedbackService.test.ts` is the existing pattern:
`import { expect, test, describe } from "bun:test";` plus `import "../tests/setup";`.
It imports only pure modules (`feedbackService` imports `../types`), which is
the constraint the new module must satisfy.

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Tests     | `bun test services/quickAdvice.test.ts` | all new tests pass |
| Typecheck | `npm run typecheck`             | exit 0, zero errors |
| Build     | `npm run build`                 | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `services/quickAdvice.ts` (create)
- `services/quickAdvice.test.ts` (create)
- `services/geminiService.ts` — replace the two blocks above with calls into
  the new module; nothing else
- `app/components/QuickModeScreen.tsx` — swap the inline `isDegraded` memo and
  (optionally) `handleCopyAll` body to use the new helpers

**Out of scope** (do NOT touch):
- The prompt text in `geminiService.ts` (any string that starts with
  `SYSTEM IDENTITY` or `TASK:`), the model chain lists, `runWithFallback`
- `services/feedbackService.ts`, `types.ts`
- The UI rendering of the results page

## Git workflow

- Branch: `advisor/003-quick-advice-tests`
- Commit message style: `test: extract quick advice normalization into pure module with characterization tests`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `services/quickAdvice.ts`

A new module with **no imports from `services/` or `app/`** — only `import { QuickAdviceResponse, SuggestionOption } from "../types";`. Repo convention: `services/` modules are plain TS, double-quoted strings, named exports, JSDoc block comments on each export.

Export exactly these four functions and one constant:

```ts
export const FALLBACK_PRO_TIP = "ngl couldn't read that one properly, try again";
```

1. `normalizeQuickAdvice(parsed: any): QuickAdviceResponse` — move the
   `normalize` filter + the whole response-assembly block verbatim (behavior
   identical: roast folds into bold only when bold normalizes empty, vibe
   defaults, `wait: parsed.suggestions?.wait ?? null`, proTip fallback,
   `recommendedAction || 'MATCH'`). Keep the `(parsed.suggestions as any)?.roast`
   access — legacy payloads carry the key even though the type no longer does.
2. `buildQuickFallback(): QuickAdviceResponse` — move the fallback object
   verbatim (5 tones × 3 identical fallback options, `wait: undefined`).
3. `isQuickAdviceDegraded(r: QuickAdviceResponse): boolean` — move the
   `QuickModeScreen` heuristic verbatim: `r.proTip === FALLBACK_PRO_TIP` OR
   `r.suggestions.smooth?.[0]?.replies?.[0]?.reply === "hey"`.
4. `buildCopyPayload(option: SuggestionOption): string` — move the
   `handleCopyAll` join verbatim: replies joined `"\n\n"`, plus
   `"\n\n" + option.conversationHook` when present.

**Verify**: `npx tsc --noEmit services/quickAdvice.ts` exits 0 (or just run the
full `npm run typecheck` after Step 2 — the module is not yet imported).

### Step 2: Rewire `geminiService.ts`

In `getQuickAdvice`:
- Add `import { normalizeQuickAdvice, buildQuickFallback, FALLBACK_PRO_TIP } from "./quickAdvice";`
  at the top (existing import block style: `import { getPromptBias } from "./feedbackService";`).
- Replace the response-assembly block with `return normalizeQuickAdvice(parsed);`
- Replace the catch-path fallback return with `return buildQuickFallback();`
- Remove the now-unused inline `normalize` helper and the local `fallbackOption`.
- `SuggestionOption` may become an unused import in this file — remove it from
  the type import list if `npm run typecheck` reports it unused (the project
  does not error on unused locals by default, but keep the file tidy).

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Rewire `QuickModeScreen.tsx`

- Add `import { isQuickAdviceDegraded, buildCopyPayload } from "../../services/quickAdvice";`
  to the existing imports (note the `../../` — the file lives in `app/components/`).
- Replace the `isDegraded` memo body (lines 155–162) with:
  ```ts
  const isDegraded = useMemo(() => (result ? isQuickAdviceDegraded(result) : false), [result]);
  ```
- Replace `handleCopyAll`'s join lines with a call to `buildCopyPayload`:
  ```ts
  const handleCopyAll = async () => {
    if (!selectedOption) return;
    await handleCopy(buildCopyPayload(selectedOption), `copyall-${activeTone}-${cursor[activeTone]}`);
  };
  ```

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Write `services/quickAdvice.test.ts`

Model the structure on `services/feedbackService.test.ts` (`bun:test`
imports, `describe`/`test`/`expect`, `import "../tests/setup";`). Cover:

1. `normalizeQuickAdvice` — legacy fold: payload with NO `bold` but a `roast`
   array of 1 valid option → `bold` contains that option, `roast` is absent
   from the result object.
2. `normalizeQuickAdvice` — precedence: payload with both `bold` (1 option)
   and `roast` (1 option) → `bold` keeps its own option.
3. `normalizeQuickAdvice` — filtering: an option with `replies: []` is
   dropped; a tone that normalizes to zero options becomes `[]`.
4. `normalizeQuickAdvice` — defaults: no `vibeCheck` → neutral/50/[]; no
   `proTip` → `FALLBACK_PRO_TIP`; no `recommendedAction` → `"MATCH"`;
   `wait` passes through, `wait: undefined` becomes `null`.
5. `buildQuickFallback` — 5 tones × 3 options, every option replies to 1
   message, `proTip === FALLBACK_PRO_TIP`, `recommendedAction === "MATCH"`.
6. `isQuickAdviceDegraded` — true for `buildQuickFallback()`; false for a
   normalized normal payload (option 4's object, with a proTip that is not the
   fallback string).
7. `buildCopyPayload` — 2 replies + hook → `"r1\n\nr2\n\nhook"`; 1 reply, no
   hook → `"r1"`; a `false`/empty reply string is filtered out by the
   existing `.filter(Boolean)`.

Each test needs only literal fixture objects — no mocks, no network.

**Verify**: `bun test services/quickAdvice.test.ts` → all tests pass.

### Step 5: Full verification

**Verify**:
1. `bun test` → the full suite passes (12 existing + new tests)
2. `npm run typecheck` → exit 0
3. `npm run build` → `✓ built in <n>s`

## Test plan

New file `services/quickAdvice.test.ts` with the 7 cases above, following the
`feedbackService.test.ts` structure. The tests are characterization tests —
they pin today's behavior so later plans (004, 007, 008) can refactor under
them. When plan 004 lands, extend case 5/6 for the `degraded` flag.

## Done criteria

All must hold:

- [ ] `bun test services/quickAdvice.test.ts` passes
- [ ] `bun test` passes (no regressions in `feedbackService.test.ts`)
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] `Select-String -Path services\geminiService.ts -Pattern 'const normalize ='` returns no matches (inline helper removed)
- [ ] `Select-String -Path services\geminiService.ts -Pattern "ngl couldn't read"` returns 0 matches (fallback string lives only in `quickAdvice.ts`)
- [ ] `services/quickAdvice.ts` imports nothing from `./` or `app/` (only `../types`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live files (drift).
- `bun test` fails to import `services/quickAdvice.ts` (a hidden dependency —
  the module must stay free of Firebase/service imports; remove the dependency
  rather than fighting the runner).
- The response-shape behavior needs to change to make a test pass — these are
  characterization tests; if the current behavior looks wrong, record it and
  stop (behavior changes are separate decisions, e.g. plan 004).

## Maintenance notes

- `services/quickAdvice.ts` is the single home for Quick Mode pure logic;
  future changes to tone handling, fallback, degraded detection, or the copy
  payload shape happen here and are testable.
- Keep `geminiService.ts` free of inline JSON-shaping logic — the prompt and
  transport belong there, the shape logic belongs in `quickAdvice.ts`.
- Plan 004 adds `degraded?: boolean` to `normalizeQuickAdvice`'s output and
  `isQuickAdviceDegraded`'s inputs; the extraction here is its prerequisite.
