# Plan 005: Fix amber text contrast (AA) in wait state + action pills

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md`. Verify the excerpts below match
> `app/components/QuickModeScreen.tsx` and `app/components/HistoryScreen.tsx`.
> On a mismatch, STOP and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (accessibility)
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The wait-state ("Don't reply yet") and the WAIT/PULL_BACK action pills render
amber text `#B8860B` at 11–13px on light tint backgrounds. The contrast ratio
is ≈ 3.0:1 against `#FEF3E2` — below the WCAG AA 4.5:1 floor for normal text,
and this is exactly the screen a low-vision user needs to be able to read
(it's a safety-relevant "hold off" instruction). The codebase already ships
the correct token: the strip's amber chips use `#7A5400` (≈ 6.1:1 on the
canvas). This plan swaps the failing literals for the darker token.

## Current state

`app/components/QuickModeScreen.tsx` — wait advisory label (line 689):

```tsx
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#B8860B", textTransform: "uppercase" }}>
                      Don't reply yet
                    </p>
```

Wait advisory dismiss button (line 696):

```tsx
                      style={{ width: 44, height: 44, borderRadius: 22, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(184,134,11,0.7)" }}
```

`actionLabel` map (lines 310–317) — WAIT and PULL_BACK use the failing token;
their pills render at 12–13px via the strip (line ~893) and would inherit the
fix:

```ts
  const actionLabel: Record<string, { label: string; color: string; bg: string }> = {
    SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    WAIT: { label: "Wait", color: "#B8860B", bg: "rgba(212,168,83,0.12)" },
    CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
    MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    PULL_BACK: { label: "Pull back", color: "#B8860B", bg: "rgba(212,168,83,0.12)" },
    ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  };
```

The Clock icon (line 686, `color="#B8860B"`) is decorative — leave it.

`app/components/HistoryScreen.tsx` — replay wait label (line 359):

```tsx
              <p style={{ ...labelStyle, color: "#B8860B" }}>Don't reply yet</p>
```

Verified scope of `#B8860B` across the app: `app/components/HomeScreen.tsx:548`
is a decorative Clock icon (leave). No other text uses it.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, zero errors  |
| Build     | `npm run build`    | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `app/components/QuickModeScreen.tsx` — 3 literal swaps (line 689, line 696, actionLabel lines 322 & 325)
- `app/components/HistoryScreen.tsx` — 1 literal swap (line 359)

**Out of scope** (do NOT touch):
- Decorative icons (`HomeScreen.tsx:548`, `QuickModeScreen.tsx:686` Clock icons)
- The strip chips' amber (`#7A5400`) already in place — leave them
- Any other color tokens (terracotta/sage pairs pass AA at the sizes used)
- Plan 007 will move the `actionLabel` map into a shared module **after** this
  plan, so the fixed color ships in the shared copy

## Git workflow

- Branch: `advisor/005-amber-contrast`
- Commit message style: `fix: darken amber text to pass AA contrast in wait state`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix `QuickModeScreen.tsx`

Replace, in the wait advisory label (line 689):
- `color: "#B8860B"` → `color: "#7A5400"`

Replace, in the dismiss button (line 696):
- `color: "rgba(184,134,11,0.7)"` → `color: "rgba(122,90,8,0.8)"`

Replace, in the `actionLabel` map — both occurrences of `color: "#B8860B"`
(WAIT and PULL_BACK rows):
- → `color: "#7A5400"`

**Verify**: `Select-String -Path app\components\QuickModeScreen.tsx -Pattern '#B8860B'` →
exactly 1 remaining match, the decorative Clock icon at line 686.

### Step 2: Fix `HistoryScreen.tsx`

Replace (line 359): `color: "#B8860B"` → `color: "#7A5400"`.

**Verify**: `Select-String -Path app\components\HistoryScreen.tsx -Pattern '#B8860B'` →
0 matches.

### Step 3: Verify

**Verify**:
1. `npm run typecheck` → exit 0
2. `npm run build` → `✓ built in <n>s`
3. `Select-String -Path app\**\*.tsx -Pattern '#B8860B'` → only `app/components/HomeScreen.tsx:548` (decorative icon)

## Test plan

No unit tests apply (color literals in inline styles). Verification is the
grep gates above plus a visual smoke check of the wait advisory and a
WAIT/PULL_BACK strip pill (contrast ≈ 6:1 after the change). If you can run
`npm run dev` and see a wait-state result, confirm the amber text is clearly
readable; otherwise state in your report that visual verification was not
performed.

## Done criteria

All must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] `Select-String -Path app\components\QuickModeScreen.tsx -Pattern '#B8860B'` returns exactly 1 match (the Clock icon)
- [ ] `Select-String -Path app\components\HistoryScreen.tsx -Pattern '#B8860B'` returns no matches
- [ ] `Select-String -Path app\components\QuickModeScreen.tsx -Pattern '#7A5400'` returns ≥3 matches (label, dismiss, 2 action rows)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts don't match the live files (drift).
- `#B8860B` appears in a text role in a file outside the two in-scope files —
  report the location instead of editing that file.

## Maintenance notes

- `#7A5400` is now the canonical amber-text token (text on `#FEF3E2` /
  `rgba(212,168,83,0.12)` fills ≈ 6:1). Use it for any future amber label;
  reserve `#B8860B`/`#D4A853` for icons and large (≥18px bold) text.
- Plan 007 extracts the `actionLabel` map into a shared module — the fixed
  `#7A5400` must carry over into that shared copy; the HistoryScreen wait
  label uses `labelStyle`, so the shared module will not cover it (it is a
  literal, keep it fixed).
