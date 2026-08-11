# Plan 006: Remove nested interactive elements in tone pills

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md`. Verify the excerpt below matches
> `app/components/QuickModeScreen.tsx`. On a mismatch, STOP and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (accessibility)
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The "Your Style" tone pill nests a `<button>` (the info/help affordance)
**inside** another `<button>` (the pill itself, lines 750–761). Nested
interactive elements are invalid HTML: browsers and assistive tech mis-parse
them, screen readers can announce the wrong control or none, and activation
behavior gets inconsistent. The pill is the tone switcher — a control users
hit on every results page visit — so the fix is worth doing properly rather
than leaving invalid markup in the primary interaction.

## Current state

`app/components/QuickModeScreen.tsx`, tone pill rendering (inside the tone
rail map, `key` is the tone name; `help` is non-null only for "Your Style"):

```tsx
                    {key}
                    {help && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStyleTooltip((prev) => (prev ? null : key));
                        }}
                        className="cursor-pointer"
                        aria-label="More info"
                      >
                        <Info size={12} strokeWidth={2} color={activeTone === key ? "rgba(255,255,255,0.6)" : "rgba(26,18,8,0.35)"} />
                      </button>
                    )}
```

The outer element is the pill `<button>` (same map, opens at the pill's
`className="flex items-center gap-1.5 cursor-pointer transition-colors"`).
Tooltip state: `const [showStyleTooltip, setShowStyleTooltip] = useState<string | null>(null);`
— it is rendered outside the rail (below it), so the fix does not affect the
tooltip's positioning.

Verified: `HistoryScreen.tsx` has no such nesting (its tone chips are plain
buttons, line 562 region). This is the only occurrence in the app.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, zero errors  |
| Build     | `npm run build`    | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `app/components/QuickModeScreen.tsx` — the inner `<button>` only

**Out of scope** (do NOT touch):
- The outer pill button, the tooltip render block, the tone rail structure
- `HistoryScreen.tsx` (verified: no nesting there)
- Any styling changes beyond the element type swap (keep the icon visually
  identical)

## Git workflow

- Branch: `advisor/006-tone-pill-nested-buttons`
- Commit message style: `fix: tone pill info affordance is no longer a nested button`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Convert the inner button to a non-interactive-element role control

Replace the inner `<button ...>...</button>` (the `help && (...)` block) with a
`<span>` carrying button semantics and keyboard handling. The span must keep
`e.stopPropagation()` on click so the pill does not also switch tone, and must
handle Enter/Space for keyboard users:

```tsx
                    {key}
                    {help && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`About ${key}`}
                        className="cursor-pointer inline-flex items-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStyleTooltip((prev) => (prev ? null : key));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowStyleTooltip((prev) => (prev ? null : key));
                          }
                        }}
                      >
                        <Info size={12} strokeWidth={2} color={activeTone === key ? "rgba(255,255,255,0.6)" : "rgba(26,18,8,0.35)"} />
                      </span>
                    )}
```

Note: the tone pill button keeps its own `onClick` (switch tone); the span's
`stopPropagation` prevents the pill handler from firing when the info
affordance is activated. The `aria-label` on the span now carries the meaning
that the old generic `aria-label="More info"` carried on a button.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Verify

**Verify**:
1. `npm run typecheck` → exit 0
2. `npm run build` → `✓ built in <n>s`
3. Visually (if you can run `npm run dev` and reach a results page): tapping
   the info icon on "Your Style" toggles the tooltip without switching tone;
   the pill still switches tone when tapped on its label. If you cannot run
   the dev server, state so in your report.

## Test plan

No unit tests apply (inline JSX). The behavioral contract: (a) tone pill tap
switches tone; (b) info affordance tap toggles the tooltip and does NOT switch
tone; (c) Enter/Space on the focused info affordance toggles the tooltip.
(a) and (b) are the regression cases to check manually or via the reviewer's
smoke pass.

## Done criteria

All must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] No `<button>` remains nested inside another `<button>` in `app/components/QuickModeScreen.tsx` (inspect the tone rail block)
- [ ] `Select-String -Path app\components\QuickModeScreen.tsx -Pattern 'role="button"'` returns exactly 1 match
- [ ] `onKeyDown` handler for `Enter`/` ` exists in the tone rail block
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpt doesn't match the live file (drift).
- The tone rail structure was changed by another plan (e.g. 008's component
  split moved this JSX) — re-locate the `help &&` block by the `Info` icon
  usage; if it has already been fixed or moved, report and mark this plan
  REJECTED/superseded instead of re-editing.

## Maintenance notes

- If plan 008 (component split) extracts the tone rail, this `role="button"`
  span moves with it — keep the keyboard handler attached to the span.
- The `aria-label` value (`About ${key}`) is the accessible name; if a shared
  ToneRail component is created later, keep per-tone naming.
