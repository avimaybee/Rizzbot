# Plan 007: Share tone/action/copy logic between Quick and History

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md` **plus** `services/quickAdvice.ts` and
> `services/quickAdvice.test.ts` (plan 003) and the amber color fix from plan
> 005 in `QuickModeScreen.tsx`/`HistoryScreen.tsx`. If 003 or 005 has not
> landed, STOP and report that 007 is blocked.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 003 (pure module + tests), 005 (shared map carries the fixed color)
- **Category**: tech-debt
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The tone system is duplicated across two screens: `QuickModeScreen.tsx` and
`HistoryScreen.tsx` each define their own tone label map, tone order list, and
action-label map (with **divergent color tokens** — History uses `#D4A853`
for WAIT/PULL_BACK, Quick Mode uses `#B8860B`), plus near-identical copy
handlers. The Roast→Bold merge in this rework had to touch both files in
lockstep — that is exactly the drift the duplication caused (History's action
map still diverged). The copy-payload join now lives in `services/quickAdvice.ts`
(plan 003); this plan moves the remaining display maps into one shared module
so the next tone change is a single edit.

## Current state

`app/components/QuickModeScreen.tsx` lines 310–317 (post plan 005, WAIT/PULL_BACK now `#7A5400`):

```ts
  const actionLabel: Record<string, { label: string; color: string; bg: string }> = {
    SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    WAIT: { label: "Wait", color: "#7A5400", bg: "rgba(212,168,83,0.12)" },
    CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
    MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    PULL_BACK: { label: "Pull back", color: "#7A5400", bg: "rgba(212,168,83,0.12)" },
    ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  };
```

`app/components/HistoryScreen.tsx` lines 72–81 — its own (divergent) copies:

```ts
  const toneLabels: Record<string, string> = {
    smooth: "Smooth",
    bold: "Bold",
    witty: "Witty",
    authentic: "Authentic",
    yourStyle: "Your Style",
  };

  const toneOrder = ["smooth", "bold", "witty", "authentic", "yourStyle"];
```

`app/components/HistoryScreen.tsx` lines 118–125 — its own action map
(divergent amber: `#D4A853`):

```ts
  const actionLabel: Record<string, { label: string; color: string; bg: string }> = {
    SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    WAIT: { label: "Wait", color: "#D4A853", bg: "rgba(212,168,83,0.12)" },
    CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
    MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    PULL_BACK: { label: "Pull back", color: "#D4A853", bg: "rgba(212,168,83,0.12)" },
    ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  };
```

`services/quickAdvice.ts` (plan 003) already exports `buildCopyPayload`; both
screens' `handleCopy` implementations are identical in shape
(`navigator.clipboard.writeText` + haptic + toast + 1.5s revert) — those stay
in place (they touch UI feedback), but the maps move.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Tests     | `bun test`         | all tests pass      |
| Typecheck | `npm run typecheck`| exit 0, zero errors  |
| Build     | `npm run build`    | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `app/utils/quickLogic.ts` (create — repo convention: `app/utils/` holds hooks and shared UI logic, e.g. `useSessionState.ts`, `useScrollFade.ts`, `haptics.ts`)
- `app/components/QuickModeScreen.tsx` — delete its local maps, import the shared ones
- `app/components/HistoryScreen.tsx` — delete its local maps, import the shared ones

**Out of scope** (do NOT touch):
- `services/quickAdvice.ts` (already extracted; maps are UI chrome, not service logic — they stay in `app/`)
- Copy handlers, clipboard behavior, haptics, toasts
- HistoryScreen's legacy **rendering** (vibe dashboard, wait card layout) — this plan only unifies the maps
- Any prompt or service change

## Git workflow

- Branch: `advisor/007-shared-quick-logic`
- Commit message style: `refactor: share tone and action label maps between Quick and History screens`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `app/utils/quickLogic.ts`

Export (repo style: named exports, double quotes, JSDoc):

```ts
export const TONE_ORDER = ["smooth", "bold", "witty", "authentic", "yourStyle"] as const;

export const TONE_LABELS: Record<string, string> = {
  smooth: "Smooth",
  bold: "Bold",
  witty: "Witty",
  authentic: "Authentic",
  yourStyle: "Your Style",
};

export const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
  WAIT: { label: "Wait", color: "#7A5400", bg: "rgba(212,168,83,0.12)" },
  CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
  PULL_BACK: { label: "Pull back", color: "#7A5400", bg: "rgba(212,168,83,0.12)" },
  ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
};

export const getActionLabel = (action: string): { label: string; color: string; bg: string } =>
  ACTION_LABELS[action] || { label: action, color: "#1A1208", bg: "rgba(26,18,8,0.06)" };
```

Values are copied verbatim from the Quick Mode map (post-005) — **the shared
map's amber is `#7A5400`**, the History map's `#D4A853` is intentionally
replaced by the compliant token (product direction: one tone system).

**Verify**: `npm run typecheck` → exit 0 (module not yet imported — still
compiles).

### Step 2: Rewire `QuickModeScreen.tsx`

- Add `import { getActionLabel } from "../utils/quickLogic";` (file lives in
  `app/components/`, so `../utils/`).
- Delete the local `actionLabel` const (lines 310–317).
- Replace the single usage (the strip pill render, ~line 891):
  ```tsx
                  const a = actionLabel[result.recommendedAction!] || { label: result.recommendedAction!, color: "#1A1208", bg: "rgba(26,18,8,0.06)" };
  ```
  with:
  ```tsx
                  const a = getActionLabel(result.recommendedAction!);
  ```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Rewire `HistoryScreen.tsx`

- Add `import { TONE_ORDER, TONE_LABELS, getActionLabel } from "../utils/quickLogic";`
  (verify HistoryScreen's path — it lives in `app/components/`, same `../utils/`).
- Delete the local `toneLabels` and `toneOrder` consts (lines 72–81) and the
  local `actionLabel` map (lines 118–125).
- Replace references: `toneLabels[...]` → `TONE_LABELS[...]`, `toneOrder` →
  `TONE_ORDER` (keep the legacy roast fallback in `optionsForTone` untouched —
  it reads stored data, not the label maps), and the local
  `actionLabel[...] || {...}` fallback usages → `getActionLabel(...)`.
- Locate usages by grep before editing: `Select-String -Path app\components\HistoryScreen.tsx -Pattern 'toneLabels|toneOrder|actionLabel'` and fix each occurrence. Do not rename variables that are local to other concerns.

**Verify**: `npm run typecheck` → exit 0, and
`Select-String -Path app\components\HistoryScreen.tsx -Pattern 'const actionLabel|const toneLabels|const toneOrder'`
returns no matches.

### Step 4: Verify

**Verify**:
1. `bun test` → all tests pass
2. `npm run typecheck` → exit 0
3. `npm run build` → `✓ built in <n>s`
4. `Select-String -Path app\**\*.tsx -Pattern '#D4A853'` → 0 matches (the divergent amber is gone; any remaining `#D4A853` usage would be outside these maps — check the results and report if it appears)

## Test plan

The maps are display constants; plan 003's tests already cover the logic that
matters (`buildCopyPayload`). Behavioral gate: grep-level (no local map
definitions remain) + build. Optional: `services/quickAdvice.test.ts` gains no
new cases here — do not add UI-color tests.

## Done criteria

All must hold:

- [ ] `bun test` passes
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] `Select-String -Path app\**\*.tsx -Pattern 'const actionLabel|const toneLabels|const toneOrder'` returns no matches
- [ ] `Select-String -Path app\components\HistoryScreen.tsx -Pattern 'toneLabels|toneOrder'` returns ≥1 match (shared import usage)
- [ ] `app/utils/quickLogic.ts` exists with `TONE_ORDER`, `TONE_LABELS`, `ACTION_LABELS`, `getActionLabel` exports
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003 or 005 has not landed (blocked, report).
- HistoryScreen's usages are structurally different from the excerpt (its
  replay UI is legacy code with different variable shapes) — do not guess;
  list the exact mismatch and stop.
- The shared amber token `#7A5400` would visibly change History's wait pill in
  a way you judge product-breaking — it is a 2-tone darkening; continue unless
  a screenshot proves it unreadable, then report.

## Maintenance notes

- The next tone change (labels, order, or colors) is now a single edit in
  `app/utils/quickLogic.ts`.
- HistoryScreen's legacy render (vibe bars, old wait card) still diverges
  visually from Quick Mode — unifying the maps is the data layer of that
  convergence; the rendering unification is not in scope and would be a
  product decision.
- If plan 008 extracts Quick Mode components, they should import from
  `quickLogic.ts` and `services/quickAdvice.ts`, not define their own maps.
