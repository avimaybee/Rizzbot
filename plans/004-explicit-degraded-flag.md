# Plan 004: Explicit `degraded` flag instead of string heuristics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md` **plus** `services/quickAdvice.ts` and
> `services/quickAdvice.test.ts` (plan 003 must have landed). If plan 003 has
> not landed, STOP and report that 004 is blocked.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 003 (the pure module + its tests)
- **Category**: bug
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

Degraded responses (the service catch-path fallback: reply `"hey"`, hook
`"whats good"`, proTip `"ngl couldn't read that one properly, try again"`) are
currently detected by **exact string matching** in the UI
(`app/components/QuickModeScreen.tsx` `isDegraded` memo). Any prompt drift —
a reworded proTip instruction, a changed fallback string — silently breaks
the detection and the degraded banner stops showing: real failures masquerade
as confident advice again. The service knows when it degraded (it built the
fallback); it should say so explicitly on the contract, with the string
heuristic kept only as a backward-compat fallback for sessions stored before
this flag existed.

## Current state

`types.ts` — `QuickAdviceResponse` (relevant tail, around lines 176–193):

```ts
  proTip: string; // One psychology-backed insight
  recommendedAction: 'SEND' | 'WAIT' | 'CALL' | 'MATCH' | 'PULL_BACK' | 'ABORT';
  // New guidance fields (0-100 scale and short timing text)
  interestSignal?: number; // 0-100 recommended explicit interest level to show
  timingRecommendation?: string; // e.g., "reply within a few hours; prioritize thoughtful reply over speed"
```

`services/quickAdvice.ts` (created by plan 003) — the four exports are
`normalizeQuickAdvice(parsed: any): QuickAdviceResponse`,
`buildQuickFallback(): QuickAdviceResponse`,
`isQuickAdviceDegraded(r: QuickAdviceResponse): boolean`, and
`buildCopyPayload(option: SuggestionOption): string`, plus
`export const FALLBACK_PRO_TIP = "ngl couldn't read that one properly, try again";`.

`app/components/QuickModeScreen.tsx` (after plan 003):

```ts
  const isDegraded = useMemo(() => (result ? isQuickAdviceDegraded(result) : false), [result]);
```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `bun test services/quickAdvice.test.ts` | all tests pass |
| Typecheck | `npm run typecheck`                  | exit 0, zero errors |
| Build     | `npm run build`                      | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `types.ts` — add the optional field
- `services/quickAdvice.ts` — set/plumb the flag
- `services/quickAdvice.test.ts` — extend tests

**Out of scope** (do NOT touch):
- `app/components/QuickModeScreen.tsx` — its `isDegraded` memo already calls
  the helper; no change needed there (verify it still compiles)
- The prompt text, the fallback strings themselves, `services/geminiService.ts`
- `services/dbService.ts` session persistence — stored sessions may contain
  either shape; both are tolerated by the code below

## Git workflow

- Branch: `advisor/004-degraded-flag`
- Commit message style: `feat: explicit degraded flag on quick advice responses`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the field to the type

In `types.ts`, add an optional boolean to `QuickAdviceResponse`, next to the
existing optional guidance fields:

```ts
  recommendedAction: 'SEND' | 'WAIT' | 'CALL' | 'MATCH' | 'PULL_BACK' | 'ABORT';
  // True when the service returned its degraded fallback (failed analysis)
  degraded?: boolean;
```

**Verify**: `npm run typecheck` → exit 0 (the field is optional; nothing breaks).

### Step 2: Plumb the flag in the pure module

In `services/quickAdvice.ts`:

- `buildQuickFallback()`: add `degraded: true` to the returned object.
- `normalizeQuickAdvice(parsed)`: set `degraded: parsed?.degraded === true`
  in the returned object (a raw model payload never sets it, so this is
  `false` in practice; it keeps round-trip fidelity for any re-normalization).
- `isQuickAdviceDegraded(r)`: check the flag **first**, then the legacy
  heuristics:
  ```ts
  export function isQuickAdviceDegraded(r: QuickAdviceResponse): boolean {
    if (r.degraded === true) return true;
    if (r.proTip === FALLBACK_PRO_TIP) return true;
    const first = r.suggestions.smooth?.[0]?.replies?.[0]?.reply;
    return first === "hey";
  }
  ```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Extend the tests

In `services/quickAdvice.test.ts`:

- Case: `buildQuickFallback()` returns `degraded: true`.
- Case: `normalizeQuickAdvice` of a normal payload returns `degraded: false`
  (update the existing defaults test if it asserts an exact object shape).
- Case: `isQuickAdviceDegraded` returns `true` for an object whose `degraded`
  is `true` even when the heuristic strings differ (e.g. a custom proTip —
  this proves the flag is authoritative).
- Case: an object with `degraded: false` but the legacy fallback proTip still
  returns `true` (backward compat for pre-flag sessions).

**Verify**: `bun test services/quickAdvice.test.ts` → all tests pass.

### Step 4: Full verification

**Verify**:
1. `bun test` → full suite passes
2. `npm run typecheck` → exit 0
3. `npm run build` → `✓ built in <n>s`

## Test plan

Extend `services/quickAdvice.test.ts` with the 4 cases in Step 3. No other
test files are affected.

## Done criteria

All must hold:

- [ ] `bun test` passes
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] `Select-String -Path types.ts -Pattern 'degraded\?: boolean'` returns exactly 1 match
- [ ] `Select-String -Path services\quickAdvice.ts -Pattern 'degraded'` returns ≥3 matches (fallback, normalize, isQuickAdviceDegraded)
- [ ] `bun test services/quickAdvice.test.ts` includes a case proving the flag wins over mismatched heuristic strings
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003 has not landed (no `services/quickAdvice.ts` or its test file).
- Any stored-session consumer (e.g. `HistoryScreen.tsx`) type-errors on the
  new field — it is optional, so this should not happen; if it does, stop
  rather than changing the history screen.
- Changing `buildQuickFallback`'s returned shape breaks a test written in plan
  003 that asserts an exact object shape — update that test to the new shape
  (adding a field is a compatible change) and continue.

## Maintenance notes

- The flag is the source of truth going forward; the string heuristics are
  now purely a backward-compat layer for sessions stored before this plan.
  They can be removed once no stored session predates the flag (months of
  production use) — flag that decision in a future reconcile.
- `normalizeQuickAdvice` preserving `parsed.degraded` matters: the client
  stores the normalized response in sessions (`dbService.createSession`), so
  the flag survives round-trips.
