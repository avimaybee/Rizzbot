# Plan 008: Split QuickModeScreen into presentational components

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md` plus the outputs of plans 003, 005, 007
> (`services/quickAdvice.ts`, `services/quickAdvice.test.ts`,
> `app/utils/quickLogic.ts`, and the map deletions). If 001, 003, or 007 has
> not landed, STOP and report that 008 is blocked.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001 (clean baseline), 003 (pure logic + tests), 007 (shared maps)
- **Category**: tech-debt
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

`app/components/QuickModeScreen.tsx` is a 1138-line component holding the
input view, the loading state, the entire results page (hero reply card, tone
rail, read strip, disclosures, wait advisory), the copy/feedback/share
handlers, the swipe gesture, and session persistence. Every interaction change
to the results page — the product's core surface — risks regressing unrelated
parts of the same file. The results page's presentational blocks have stable
boundaries (a hero card, a chip strip, collapsible disclosures); extracting
them into small, pure-presentation components makes the file reviewable and
prepares it for the streaming work in plan 009. **This plan moves JSX only —
zero behavior changes.**

## Current state

`app/components/QuickModeScreen.tsx` structure (post 003/005/007):
- Component `QuickModeScreen()` — all state (`result`, `cursor`, `activeTone`,
  `copiedKey`, `openSection`, `waitDismissed`, `feedbackGiven`, `showStyleTooltip`)
  and all handlers (`handleCopy`, `handleCopyAll`, `handleFeedback`,
  `handleShare`, `handleAnalyze`, `handleEdit`, `handleRedo`) live here.
- Results branch renders (in order): wait advisory (`motion.div`, ~line 679),
  degraded banner, tone rail (`motion.div` + scroll row + `toneFade`), the
  "Your Style" tooltip, the hero reply card (`motion.div` with
  `AnimatePresence mode="wait"`, drag/swipe handlers, variation segments,
  reply bubbles, hook row), the read strip (`stripFade` scroll row of chips),
  the two disclosures (context + draft, each with `AnimatePresence` height
  animation), and the pinned copy bar (`fixed bottom-20`).

Repo conventions to follow (inline styles, no CSS files per component):
- All styling is inline `style` objects or Tailwind utilities on `className`.
- Tokens: canvas `#F5EFE6`, surface `#FDFAF5`, elevated `#FFFFFF`, ink
  `#1A1208`, inkSecondary `rgba(26,18,8,0.55)`, divider `#E8E0D4`, terracotta
  `#C8522A`, terracottaTint `#F5E8E0`, sage `#7A9E7E`, amber text `#7A5400`.
- Fonts via `fontFamily` in style: `"'DM Sans', sans-serif"` (UI/body),
  `"'Cormorant Garamond', serif"` (voice accents, italic), `"'JetBrains Mono', monospace"` (data).
- Every interactive element ≥44pt hit target; haptics via `haptics.light()`
  on selection taps.
- Existing component files in `app/components/`: flat, one component per file,
  named exports.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Tests     | `bun test`         | all tests pass      |
| Typecheck | `npm run typecheck`| exit 0, zero errors  |
| Build     | `npm run build`    | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `app/components/QuickModeScreen.tsx` — replace moved JSX with component usages
- Create in `app/components/quick/`:
  - `ReplyHeroCard.tsx`
  - `ReadStrip.tsx`
  - `DisclosureCard.tsx`
  - (plus `ToneRail.tsx` only if the rail moves cleanly — see Step 2)

**Out of scope** (do NOT touch):
- Any handler logic, state shape, or behavior — this is a pure extraction
- `HistoryScreen.tsx`, `services/`, `types.ts`, `app/utils/`
- The input view, loading skeleton, header, and pinned bar (they stay in the screen for now — the bar is thin but tightly coupled to `selectedOption`/`copiedKey`; revisit after 009)

## Git workflow

- Branch: `advisor/008-split-quickmodescreen`
- Commit message style: `refactor: extract results page presentational components from QuickModeScreen`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `app/components/quick/DisclosureCard.tsx`

A generic collapsible (matches the two existing disclosure blocks exactly).
Props: `title: string`, `open: boolean`, `onToggle: () => void`,
`children: React.ReactNode`. Internal: the 44pt toggle button with the
rotating `ChevronRight` (already imported from lucide-react), and the
`AnimatePresence`/`motion.div` height animation (`initial={{ height: 0, opacity: 0 }}`,
`animate={{ height: "auto", opacity: 1 }}`, `exit={{ height: 0, opacity: 0 }}`,
`transition={{ duration: 0.22, ease: "easeOut" }}`, `style={{ overflow: "hidden" }}`).
Copy the JSX from the context disclosure (including `aria-expanded`) verbatim,
parameterizing `title` and the header label color/weight exactly as today
(`fontSize: 13, fontWeight: 600, color: "#1A1208"`).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Create `app/components/quick/ReplyHeroCard.tsx` and `ReadStrip.tsx`

`ReplyHeroCard` — move the hero card `motion.div` + `AnimatePresence` +
drag/swipe logic + variation segments + reply bubbles + hook row + empty
state verbatim. Props (all readonly, no logic moved):
`selectedOption: SuggestionOption | null`,
`optionCount: number`, `activeTone: string`, `cursor: number`,
`copiedKey: string | null`, `prefersReducedMotion: boolean | null`,
`onCopy: (text: string, key: string) => void`,
`onSelectVariation: (i: number) => void`,
`onDragEnd: (info: { offset: { x: number }; velocity: { x: number } }) => void`.
The component imports `motion`, `AnimatePresence`, `Check`, `Copy`,
`CornerDownRight`, `Link2` from their current packages and `SuggestionOption`
from `../../../types` (path: `app/components/quick/` → `../../../types`).

`ReadStrip` — move the strip `motion.div` + scroll row + all chips verbatim.
Props: `ghostRisk: number`, `riskColor: string`, `result: QuickAdviceResponse | null`,
`scrollFade: { ref: React.RefObject<HTMLDivElement | null>; style: React.CSSProperties }`.
Import `getActionLabel` from `../../utils/quickLogic`. Keep the chip
styling/order byte-for-byte (ghost, energy, interest, green flags, red flags,
next-move pill, proTip in Cormorant italic).

Do NOT extract the tone rail and pinned bar in this plan if their extraction
would require passing more than ~8 props or touching the drag/tooltip
interplay — the rail can wait for 009. If you judge the rail extractable
cleanly (it needs: `toneOptions`, `activeTone`, `onSelect`, `help` handling,
tooltip state, `toneFade`), create `ToneRail.tsx`; otherwise leave it in the
screen and say so in your report.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Rewire `QuickModeScreen.tsx`

Replace the moved JSX blocks with:

```tsx
            <DisclosureCard title="Their message" open={openSection === "context"} onToggle={() => setOpenSection(openSection === "context" ? null : "context")}>
              {/* context body verbatim: conversationContext, message list, detectedMeta chips */}
            </DisclosureCard>
```

(and the draft disclosure the same way), plus:

```tsx
            <ReplyHeroCard
              selectedOption={selectedOption}
              optionCount={selectedOptions.length}
              activeTone={activeTone}
              cursor={cursor[activeTone]}
              copiedKey={copiedKey}
              prefersReducedMotion={prefersReducedMotion}
              onCopy={(text, key) => void handleCopy(text, key)}
              onSelectVariation={(i) => { haptics.light(); setCursor((prev) => ({ ...prev, [activeTone]: i })); }}
              onDragEnd={({ offset, velocity }) => {
                if (selectedOptions.length <= 1) return;
                const flick = Math.abs(offset.x) > 56 || (Math.abs(offset.x) > 24 && Math.abs(velocity.x) > 500);
                if (!flick) return;
                const dir = offset.x < 0 ? 1 : -1;
                haptics.light();
                setCursor((prev) => ({ ...prev, [activeTone]: (prev[activeTone] + dir + selectedOptions.length) % selectedOptions.length }));
              }}
            />
```

and the strip as `<ReadStrip ... />` (pass `stripFade` and the computed risk
values). Move the `toneFade`/`stripFade` refs with their JSX (props pass the
`ref` through `scrollFade`). Delete the moved code; the screen keeps state,
handlers, input view, loading, header, and pinned bar. The reply card's
internal `key={`${activeTone}-${cursor[activeTone]}`}` and `aria-live` move
with it — pass `activeTone`/`cursor` so the key stays identical.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Verify behavior is unchanged

**Verify**:
1. `bun test` → all tests pass
2. `npm run typecheck` → exit 0
3. `npm run build` → `✓ built in <n>s`
4. Manual smoke (required — this is a pure extraction and must render
   identically): run `npm run dev`, trigger one analysis, and confirm: hero
   card renders with caption + segments; swipe changes variation; bubble tap
   copies; strip scrolls with edge fade; both disclosures expand/collapse with
   the height animation; wait advisory shows when `suggestions.wait` is
   present (force by temporarily hardcoding it in the dev console if needed —
   do not commit that). Record the smoke result in your report.

## Test plan

No new unit tests (presentational extraction; plan 003's tests guard the
logic). The regression gate is the Step 4 smoke pass plus the build. If the
reviewer can run the app, they should re-check the swipe and disclosure
animations specifically — the two most likely places for an extraction typo.

## Done criteria

All must hold:

- [ ] `bun test` passes
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] Files exist: `app/components/quick/DisclosureCard.tsx`, `app/components/quick/ReplyHeroCard.tsx`, `app/components/quick/ReadStrip.tsx` (plus `ToneRail.tsx` only if Step 2 succeeded)
- [ ] `app/components/QuickModeScreen.tsx` is < 800 lines (`(Get-Content app\components\QuickModeScreen.tsx).Count`)
- [ ] No behavior change: `Select-String -Path app\components\quick\*.tsx -Pattern 'onDragEnd'` returns ≥1 match (swipe survived the move)
- [ ] Smoke-pass results recorded in the plan's status note or your report
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plans 001, 003, or 007 have not landed (blocked, report).
- Any moved block requires a behavior tweak to extract cleanly (e.g. the
  swipe handler needs a prop that doesn't exist yet) — do not change behavior;
  stop and report the mismatch.
- The component count or prop list balloons beyond the shapes above (a sign
  the extraction boundary is wrong) — stop and propose a different split.
- The dev-server smoke pass reveals any rendering difference you cannot trace
  to a typo you can fix within the in-scope files — stop and report.

## Maintenance notes

- After 009 (streaming) lands, the streaming state will live in
  `ReplyHeroCard`'s parent and flow in as props — the extraction here is what
  makes that change localized.
- Keep the `key` prop on `ReplyHeroCard`'s internal `motion.div` driven by
  `activeTone` + `cursor` — it is load-bearing for the crossfade.
- The pinned copy bar stays in the screen for now; if it grows (e.g. "Copy
  replies" / "Copy + hook" split), extract it next with the same prop pattern.
