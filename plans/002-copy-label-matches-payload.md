# Plan 002: Make the copy button label match its payload

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. Expect the 5 modified
> files listed in `plans/README.md` (the Quick Mode rework working tree), and
> verify the excerpt in "Current state" matches `app/components/QuickModeScreen.tsx`.
> On a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (for a working typecheck gate)
- **Category**: bug
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The pinned copy bar is the primary action of the new results page. When a
tone's option has exactly **one** reply plus a conversation hook, the button
reads **"Copy reply"** but `handleCopyAll` copies **two** messages: the reply
and the hook, joined with `\n\n`. The user pastes an unintended follow-up line
into a real chat — in the exact product moment (copy → paste → send) where
mistakes matter most. The fix is a two-line label change; the payload is the
intended product behavior (replies + hook by default, per the Quick Mode
design decision).

## Current state

`app/components/QuickModeScreen.tsx`:

Payload assembly (`handleCopyAll`, lines 381–386):

```ts
  const handleCopyAll = async () => {
    if (!selectedOption) return;
    const replies = selectedOption.replies.map((r) => r.reply).filter(Boolean).join("\n\n");
    const hook = selectedOption.conversationHook ? `\n\n${selectedOption.conversationHook}` : "";
    await handleCopy(`${replies}${hook}`, `copyall-${activeTone}-${cursor[activeTone]}`);
  };
```

Label logic (lines 1111–1121, inside the pinned bottom bar):

```tsx
                  {copiedKey === `copyall-${activeTone}-${cursor[activeTone]}` ? (
                    <>
                      <Check size={18} strokeWidth={2.5} /> Copied
                    </>
                  ) : !selectedOption ? (
                    "Nothing to copy"
                  ) : selectedOption.replies.length > 1 ? (
                    "Copy all"
                  ) : (
                    "Copy reply"
                  )}
```

The bug: `selectedOption.replies.length > 1` decides the label, but the
payload includes the hook whenever it exists. With `replies.length === 1` and
a hook present, the label understates the payload.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, zero errors  |
| Build     | `npm run build`    | `✓ built in <n>s`   |

(Requires plan 001 to be merged first — `typecheck` script and clean tsc
baseline.)

## Scope

**In scope** (the only files you should modify):
- `app/components/QuickModeScreen.tsx` — the label ternary only

**Out of scope** (do NOT touch):
- `handleCopyAll` and the copy payload semantics (replies + hook by default is
  the decided product behavior)
- `HistoryScreen.tsx` — its replay copy affordances are out of scope for this
  bug (verified: it has no equivalent `handleCopyAll`; revisit in plan 007 if
  a similar label appears there)
- Any prompt/service changes

## Git workflow

- Branch: `advisor/002-copy-label-payload`
- Commit message style: `fix: copy button label reflects reply + hook payload`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the label condition

In `app/components/QuickModeScreen.tsx`, replace the label ternary condition
`selectedOption.replies.length > 1` with a condition that counts the hook as
part of the payload:

```tsx
                  ) : !selectedOption ? (
                    "Nothing to copy"
                  ) : selectedOption.replies.length + (selectedOption.conversationHook ? 1 : 0) > 1 ? (
                    "Copy all"
                  ) : (
                    "Copy reply"
                  )}
```

If you prefer, hoist the count into a variable above the `return` of the
results branch — either way the condition must equal the number of clipboard
lines the button copies: `replies.length + (conversationHook ? 1 : 0)`.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Build

**Verify**: `npm run build` → `✓ built in <n>s`.

## Test plan

No unit test infrastructure exists for this component (results UI is
untested; plan 003 adds the pure logic module). The behavioral check is:
single reply + hook → label reads "Copy all" (it copies 2 lines); single
reply, no hook → "Copy reply" (1 line); 2+ replies → "Copy all" either way.
If you can run the dev server (`npm run dev`) and click through one analysis,
confirm the labels visually; otherwise state in your report that manual
verification was not performed.

## Done criteria

All must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] `Select-String -Path app\components\QuickModeScreen.tsx -Pattern 'replies.length > 1'` returns no matches (the old condition is gone)
- [ ] `Select-String -Path app\components\QuickModeScreen.tsx -Pattern 'selectedOption.conversationHook ? 1 : 0'` returns exactly 1 match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpt in "Current state" does not match the live file (drift).
- The ternary structure differs from the excerpt (e.g. a previous change
  reworked the bar) — locate the label by the strings "Copy all"/"Copy reply"
  and if it still can't be matched, stop.
- Plan 001 has not landed (`npm run typecheck` still reports scaffold errors)
  — report that 002 is blocked on 001 instead of fixing the scaffold yourself.

## Maintenance notes

- If the product later adds an opt-in "include hook" toggle, this label
  condition must be updated in the same place — keep the count derivation in
  one expression so it stays in sync.
- Plan 003 introduces `buildCopyPayload()` in `services/quickAdvice.ts`;
  when it lands, `handleCopyAll` can consume it — the label expression here
  must keep agreeing with whatever that helper joins.
