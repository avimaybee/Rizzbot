# Plan 001: Restore a working verification baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git status --short`. This plan expects
> exactly these 5 modified files in the working tree:
> `app/components/HistoryScreen.tsx`, `app/components/QuickModeScreen.tsx`,
> `services/feedbackService.ts`, `services/geminiService.ts`, `types.ts`.
> If other files are modified, or `app/components/ui/` looks different from
> the listing in Step 1, STOP and report — do not proceed.

## Status

- **Priority**: P0
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `0704ef7`, 2026-08-11
- **Issue**: —

## Why this matters

The repo has no usable verification gate: `npx tsc --noEmit` fails with ~48
errors, every one of them in dead shadcn scaffold files under
`app/components/ui/` that import packages that were never installed
(`@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`,
etc.), plus a file-casing clash (`skeleton.tsx` vs `Skeleton.tsx`, TS1149).
`package.json` has no `test` or `typecheck` scripts even though a `bun:test`
suite exists (`services/feedbackService.test.ts`, 12 tests) and `bun` 1.3.9 is
installed on this machine. Until this lands, no other plan in this series has
a machine-checkable "did I break anything" gate, and every future change ships
unverifiable.

## Current state

- `app/components/ui/` contains 52 files. Only **two** are imported anywhere
  in the app (verified by grep across `app/**/*.tsx`):
  - `Toast.tsx` — imported by `app/App.tsx:3`, `app/components/HistoryScreen.tsx:27`,
    `app/components/MyVoiceScreen.tsx:16`, `app/components/PracticeScreen.tsx:27`,
    `app/components/QuickModeScreen.tsx:27`, `app/components/TherapistScreen.tsx:28`
  - `Skeleton.tsx` — imported by `app/components/QuickModeScreen.tsx:26`
- Everything else in that directory (48 files) is dead scaffold: it imports
  packages that do not exist in `package.json` dependencies/devDependencies
  and is not imported by any living code. The `sidebar.tsx` file imports
  `./skeleton` which triggers the TS1149 casing conflict with the live
  `Skeleton.tsx`.
- `package.json` scripts (verbatim):
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
  ```
- Test runner: `bun` 1.3.9 installed globally; `services/feedbackService.test.ts`
  imports from `"bun:test"` and `"../tests/setup"` (`tests/setup.ts` exists).
  Run it with `bun test` — it currently passes (12 tests).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, zero errors |
| Tests     | `bun test`         | 12 tests pass       |
| Build     | `npm run build`    | `✓ built in <n>s`   |

## Scope

**In scope** (the only files you should modify):
- `app/components/ui/` — delete the 48 dead files listed in Step 1
- `package.json` — add `typecheck` and `test` scripts

**Out of scope** (do NOT touch, even though they look related):
- `app/components/ui/Toast.tsx`, `app/components/ui/Skeleton.tsx` — keep both
- Any `.tsx`/`.ts` file outside `app/components/ui/` and `package.json`
- `node_modules`, `dist/`, lockfiles — no dependency changes
- No changes to `tsconfig.json` — the fix is removing the broken files, not
  hiding them

## Git workflow

- Branch: `advisor/001-verification-baseline`
- Commit message style (match repo `git log`): `fix: remove dead ui scaffold and add typecheck/test scripts`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the dead-file inventory

Run:
```powershell
Get-ChildItem app\components\ui | Select-Object Name
```
Verify it contains 52 entries, and that the live files `Toast.tsx` and
`Skeleton.tsx` are present. Confirm no other imports exist:

```powershell
Select-String -Path app\**\*.tsx -Pattern 'components/ui' | Select-Object Path, LineNumber
```
Expected: only references to `./ui/Toast` and `./ui/Skeleton` (6 import sites,
listed in "Current state").

**Verify**: the two commands above produce the expected output. If any other
`ui/` file is imported, STOP and report.

### Step 2: Delete the dead files

Delete every file in `app/components/ui/` **except** `Toast.tsx` and
`Skeleton.tsx`:

```powershell
Get-ChildItem app\components\ui -Exclude Toast.tsx, Skeleton.tsx | Remove-Item -Recurse -Force
```

The deleted list (48 files) is: `accordion.tsx`, `alert.tsx`,
`alert-dialog.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`,
`breadcrumb.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`,
`chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`,
`context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`,
`form.tsx`, `hover-card.tsx`, `input.tsx`, `input-otp.tsx`, `label.tsx`,
`LoadingState.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`,
`popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`,
`scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`,
`slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`,
`textarea.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tooltip.tsx`,
`use-mobile.ts`, `utils.ts`.

**Verify**: `Get-ChildItem app\components\ui | Select-Object Name` →
exactly `Skeleton.tsx` and `Toast.tsx`.

### Step 3: Add the scripts

Open `package.json` and replace the `scripts` block with:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
```

**Verify**: `npm run typecheck` → exit 0, no output errors.

### Step 4: Confirm the whole baseline

Run, in order:
1. `npm run typecheck` → exit 0 (the TS1149 casing error must be gone)
2. `bun test` → all 12 tests pass
3. `npm run build` → `✓ built in <n>s`

**Verify**: all three pass.

## Test plan

No new tests in this plan (the baseline must first exist). The gate is:
`bun test` passes 12 tests (existing `services/feedbackService.test.ts`),
and `npm run typecheck` exits 0. Later plans (003, 004) add new test files
that the `test` script picks up automatically.

## Done criteria

All must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `bun test` exits 0, 12 tests pass
- [ ] `npm run build` succeeds
- [ ] `Get-ChildItem app\components\ui` lists exactly `Skeleton.tsx` and `Toast.tsx`
- [ ] `Select-String -Path app\**\*.tsx -Pattern 'components/ui'` shows only `Toast`/`Skeleton` references
- [ ] `package.json` scripts contain `typecheck` and `test`
- [ ] `git status --short` shows changes only in `app/components/ui/` (deletions), `package.json`, and `plans/`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any `app/components/ui/` file other than `Toast.tsx`/`Skeleton.tsx` is
  imported anywhere in the app (Step 1 grep finds a reference you didn't expect).
- Deleting the files breaks `npm run build` (a deleted file was imported after all).
- `bun` is not installed (`bun --version` fails) — the `test` script will be
  added but marked unverified; report instead of installing Bun.
- The working tree differs from the drift check in "Executor instructions".

## Maintenance notes

- Future contributors should not add new files to `app/components/ui/` that
  import packages outside `package.json` dependencies — that is exactly the
  failure mode this plan removes.
- `npm run typecheck` and `bun test` are now the repo's verification gates;
  all subsequent plans in this series rely on them.
- If someone re-runs `npx shadcn init` later, the scaffold may return; the
  same cleanup applies (keep only files that are actually imported).
