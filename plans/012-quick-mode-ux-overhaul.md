# Plan 012 — Quick Mode Input & Results UX Overhaul (V2 5-Tab Order, Multi-Bubble Cards, Friend Summary & History Parity)

> **Before you start — drift check.** This plan was written against commit `c7728b1` (`main`) and assumes Plans 010 and 011 are applied. Before touching anything, run:
>
> ```bash
> git log --oneline c7728b1..HEAD -- app/utils/quickLogic.ts app/components/QuickModeScreen.tsx app/components/quick/ app/components/HistoryScreen.tsx
> ```
>
> If unexpected changes exist, **STOP and read the diff** before applying edits. All symbol names, component props, and line numbers below are verified against `c7728b1`.

## Status

- **Priority**: P0 (replaces V1 pseudo-scientific gauges with V2 `Real · Smooth · Playful · Bold · Your Style` tabs, clean multi-bubble cards, `FriendSummaryCard`, and full History replay parity)
- **Effort**: ~3–4 hours
- **Depends on**: Plan 010 (V2 schema normalization in `services/quickAdvice.ts`) and Plan 011 (10-screenshot R2 pipeline)
- **Risk**: Low-Medium (updates `app/utils/quickLogic.ts`, `app/components/quick/ToneRail.tsx`, `app/components/quick/ReplyHeroCard.tsx`, replaces `ReadStrip.tsx` with `FriendSummaryCard.tsx`, and updates `QuickModeScreen.tsx` + `HistoryScreen.tsx`)

---

## Why this matters

Even after Plan 010 upgrades the backend to OpenCode Go (`muse-spark-1.3-contributor:xhigh`) and System Instruction v4.1, the current Quick Mode UI (`QuickModeScreen.tsx:1-874`, `ToneRail.tsx`, `ReplyHeroCard.tsx`, `ReadStrip.tsx`, `HistoryScreen.tsx`) still reflects the old V1 design in 6 places:

1. **Old V1 Tone Names & Order (`Smooth · Bold · Witty · Authentic · Your Style`)**:
   - `app/utils/quickLogic.ts:6-14` defines `TONE_ORDER = ["smooth", "bold", "witty", "authentic", "yourStyle"]`.
   - `QuickModeScreen.tsx:40-64` and `ToneRail.tsx:5` define `type Tone = "Smooth" | "Bold" | "Witty" | "Authentic" | "Your Style"` with default `"Smooth"` (`QuickModeScreen.tsx:102`).
   - System Instruction v4.1 outputs 5 distinct temperature tabs in order: **`Real` (`real`), `Smooth` (`smooth`), `Playful` (`playful`), `Bold` (`bold`), `Your Style` (`yourStyle`)**, with **`Real`** as the default initial tab.
2. **Empty `""` Quote Lines When `replyTo` is `null` in `ReplyHeroCard.tsx`**:
   - Look at `ReplyHeroCard.tsx:111-113`:
     ```tsx
     <p style={{ ... }}>"{replyItem.originalMessage}"</p>
     ```
     In V1, `originalMessage` was always populated on every bubble. In V2 (`bubbles: [{ replyTo: string | null, text: string }]`), a second follow-up bubble often has `replyTo: null` (normalized to `originalMessage: ""`). Without a guard (`{replyItem.originalMessage && (...)}`), `ReplyHeroCard.tsx` renders literal empty quotes `""` above unquoted bubbles!
3. **Pseudo-Scientific Diagnostic Pills (`ReadStrip.tsx`)**:
   - `ReadStrip.tsx:21-59` renders `ghost 50%`, `interest 50/100`, `+ greenFlags`, `− redFlags`, and a truncated single-line `proTip` pill.
   - In V2, the model does not hallucinate fake percentage gauges — instead, it writes a **2–3 sentence blunt friend read** (`result.summary || result.proTip`). That 2–3 sentence paragraph cannot fit inside a `height: 32, whiteSpace: "nowrap"` pill in `ReadStrip.tsx`; it needs a dedicated editorial card (`FriendSummaryCard.tsx`).
4. **Confusing Input Label (`"Context"`) & Always-Expanded Draft Box**:
   - `QuickModeScreen.tsx:548` labels the primary textarea `"Context"`. When a user uploads screenshots and types `"feeling sidelined lately"`, they mean their **private goal / direction**.
   - The label should dynamically read **`"Your Goal / Direction (optional)"`** when `screenshots.length > 0`, and **`"Their Message / Context"`** when `screenshots.length === 0`.
   - The second textarea (`"Your Potential Reply (optional)"`, lines 566–585) should collapse behind a clean `+ Test a reply you're thinking of sending` toggle unless clicked or non-empty.
5. **Progressive Loading Copy for `xhigh` Deep Reasoning**:
   - `QuickModeScreen.tsx:653-655` displays static `"Reading the room..."` for the entire 35–60s `muse-spark-1.3-contributor` (`xhigh`) call. Cycling through progressive stage copy keeps the wait feeling intentional and alive.
6. **Missing `ThumbsDown` Button in the Sticky Action Bar & Fake `"50% risk"` in History**:
   - `QuickModeScreen.tsx:349` already defines `handleFeedback(rating: "helpful" | "off")` and imports `ThumbsDown` on line 15, yet the fixed bottom bar (`lines 817-868`) **only renders `ThumbsUp`** and never renders `ThumbsDown`!
   - And in `QuickModeScreen.tsx:249` / `HistoryScreen.tsx:201-214, 1175-1188`, V2 sessions have no `vibeCheck.interestLevel`, so `derivedGhostRisk` defaults to `50` (`"50% risk"` on every V2 session in History) unless we pass `ghost_risk: undefined` for V2 sessions and only show the `% risk` badge in `HistoryScreen.tsx` when `typeof session.ghost_risk === "number"`.

---

## Visual Design Language (Match Existing Warm Editorial Palette)

Keep the app's cohesive **Warm Editorial Linen / Espresso / Terracotta** aesthetic used across `QuickModeScreen.tsx`, `ToneRail.tsx`, `ReplyHeroCard.tsx`, and `HistoryScreen.tsx`:
- Page surface: `#F5EFE6` with `<GrainOverlay />`
- Card surface: `#FDFAF5` / `#FFFFFF` with border `1px solid #E8E0D4`
- Reply bubble surface: `#F5E8E0` (copied `#EAF0EA`)
- Primary text: `#1A1208`
- Secondary text: `rgba(26, 18, 8, 0.55)`
- Accent terracotta: `#C8522A`
- Positive sage: `#7A9E7E` / `#58745A`
- Wait / caution amber: `#FEF3E2` surface, `#7A5400` text, `rgba(212,168,83,0.25)` border
- Typography: `'Cormorant Garamond', serif`, `'DM Sans', sans-serif`, `'JetBrains Mono', monospace`

---

## Scope

### Files to delete
1. `app/components/quick/ReadStrip.tsx` — Replaced by `app/components/quick/FriendSummaryCard.tsx`.

### Files to create
1. `app/components/quick/FriendSummaryCard.tsx` — Editorial card displaying the 2–3 sentence blunt friend read (`result.summary || result.proTip`).

### Files to modify
1. `app/utils/quickLogic.ts` — Update `TONE_ORDER` to `["real", "smooth", "playful", "bold", "yourStyle"] as const` and `TONE_LABELS` to include `real: "Real"`, `playful: "Playful"` while keeping legacy `witty: "Witty"` and `authentic: "Authentic"` labels so old V1 history rows still have labels if referenced.
2. `app/components/quick/ToneRail.tsx` — Update `type Tone = "Real" | "Smooth" | "Playful" | "Bold" | "Your Style"`.
3. `app/components/quick/ReplyHeroCard.tsx` —
   - Only render the quoted `"originalMessage"` line above a bubble when `replyItem.originalMessage && replyItem.originalMessage.trim().length > 0` (with a subtle `↪` prefix).
   - Update header copy from `"Replying to N messages"` to `"${selectedOption.replies.length} bubbles — tap any bubble to copy"` when `selectedOption.replies.length > 1`.
4. `app/components/QuickModeScreen.tsx` —
   - Update `toneOptions`, `toneMap`, `feedbackTypeMap`, and `cursor` to `"Real" | "Smooth" | "Playful" | "Bold" | "Your Style"` with default `"Real"`.
   - Add dynamic label (`"Your Goal / Direction (optional)"` when `screenshots.length > 0` vs. `"Their Message / Context"` when `screenshots.length === 0`) and collapse `"Your Potential Reply (optional)"` behind a toggle button unless opened.
   - Add progressive loading stage copy (`"Reading the screenshots & message flow..."` → `"Picking up the subtext & dynamic..."` → `"Writing 15 replies across 5 tones..."` → `"Polishing the sharpest angles..."`).
   - Replace `<ReadStrip />` with `<FriendSummaryCard result={result} />`.
   - Add the `ThumbsDown` button next to `ThumbsUp` in the bottom bar (`lines 818-827`) wired to `handleFeedback("off")`.
   - Pass `ghost_risk: undefined` in `createSession` when saving V2 responses (`Boolean(response.summary)`), so V2 sessions don't store a fake `50%` ghost risk.
5. `app/components/HistoryScreen.tsx` —
   - In `SessionDetail` (`lines 73-90`), support both V2 tones (`real`, `smooth`, `playful`, `bold`, `yourStyle`) and legacy V1 tones (`authentic`, `witty`, `roast`) via `normalizeQuickAdvice`.
   - Hide the `{risk}% risk` pill (`lines 201-214` and `1175-1188`) when `session.ghost_risk == null` and `!session.parsedResult?.analysis?.ghostRisk`.
   - Hide the `"Quoted originalMessage"` line in History replay when `r.originalMessage` is empty (`""`).

---

## Step-by-Step Implementation Instructions

### Step 1: Update `app/utils/quickLogic.ts`

Replace `app/utils/quickLogic.ts` with:

```ts
/**
 * Shared tone/action display maps for the Quick Mode and History screens.
 */

export const TONE_ORDER = ["real", "smooth", "playful", "bold", "yourStyle"] as const;

export const TONE_LABELS: Record<string, string> = {
  real: "Real",
  smooth: "Smooth",
  playful: "Playful",
  bold: "Bold",
  yourStyle: "Your Style",
  // Legacy V1 keys kept for old session replay
  witty: "Playful",
  authentic: "Real",
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

---

### Step 2: Update `app/components/quick/ToneRail.tsx`

In `app/components/quick/ToneRail.tsx:5`, update `type Tone`:

```ts
export type Tone = "Real" | "Smooth" | "Playful" | "Bold" | "Your Style";
```

---

### Step 3: Update `app/components/quick/ReplyHeroCard.tsx`

In `app/components/quick/ReplyHeroCard.tsx:74-137`:
1. Update the header subtitle (line 76):
   ```tsx
   <p style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
     {selectedOption.replies.length > 1
       ? `${selectedOption.replies.length} bubbles in order — tap any to copy`
       : "Your reply"}
   </p>
   ```
2. Guard the quoted target message paragraph (lines 111–113) so it only renders when `replyItem.originalMessage.trim().length > 0`:
   ```tsx
   {replyItem.originalMessage && replyItem.originalMessage.trim().length > 0 && (
     <p
       style={{
         fontFamily: "'DM Sans', sans-serif",
         fontSize: 12,
         fontStyle: "italic",
         color: "rgba(26,18,8,0.45)",
         lineHeight: 1.4,
         marginBottom: 5,
       }}
     >
       ↪ "{replyItem.originalMessage}"
     </p>
   )}
   ```

---

### Step 4: Create `app/components/quick/FriendSummaryCard.tsx` & Delete `ReadStrip.tsx`

1. Delete `app/components/quick/ReadStrip.tsx`.
2. Create `app/components/quick/FriendSummaryCard.tsx`:

```tsx
import type React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { QuickAdviceResponse } from "../../../types";

interface FriendSummaryCardProps {
  result: QuickAdviceResponse | null;
}

export function FriendSummaryCard({ result }: FriendSummaryCardProps) {
  const summaryText = result?.summary || result?.proTip;
  if (!summaryText) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: 0.12 }}
      className="mt-4"
      style={{
        backgroundColor: "#FDFAF5",
        border: "1px solid #E8E0D4",
        borderRadius: 18,
        padding: "14px 16px",
        boxShadow: "0 2px 10px rgba(26, 18, 8, 0.04)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={13} strokeWidth={2} color="#C8522A" />
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#C8522A",
          }}
        >
          The Read
        </span>
      </div>
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          color: "#1A1208",
          lineHeight: 1.55,
        }}
      >
        {summaryText}
      </p>
    </motion.div>
  );
}
```

---

### Step 5: Update `app/components/QuickModeScreen.tsx`

In `app/components/QuickModeScreen.tsx`:

1. **Tone configuration (`lines 40-65, 102, 110-116, 197, 291`)**:
   ```ts
   const toneOptions = [
     { key: "Real", help: "Grounded, unforced, zero games." },
     { key: "Smooth", help: "Understated charm and quiet confidence." },
     { key: "Playful", help: "Dry humor, light teasing, push-pull." },
     { key: "Bold", help: "Direct heat and unambiguous intent." },
     { key: "Your Style", help: "Matched to your real texting cadence." },
   ] as const;

   type Tone = (typeof toneOptions)[number]["key"];

   const toneMap: Record<Tone, keyof QuickAdviceResponse["suggestions"]> = {
     Real: "real",
     Smooth: "smooth",
     Playful: "playful",
     Bold: "bold",
     "Your Style": "yourStyle",
   };

   const feedbackTypeMap: Record<Tone, string> = {
     Real: "real",
     Smooth: "smooth",
     Playful: "playful",
     Bold: "bold",
     "Your Style": "yourStyle",
   };
   ```
   Initialize `activeTone` default to `"Real"` (and add a guard effect: if `activeTone` restored from `sessionStorage` is a legacy key like `"Authentic"` or `"Witty"`, reset it to `"Real"`), and initialize `cursor` to `{ Real: 0, Smooth: 0, Playful: 0, Bold: 0, "Your Style": 0 }`.

2. **Dynamic Input Labels & Collapsed Draft Toggle (`lines 539-586`)**:
   - Add `const [showDraftBox, setShowDraftBox] = useState<boolean>(() => Boolean(yourDraft.trim()));`.
   - Update the main textarea label & placeholder (`lines 548-563`):
     ```tsx
     <label
       className="block mb-1.5"
       style={{
         fontFamily: "'DM Sans', sans-serif",
         fontSize: 11,
         letterSpacing: "0.12em",
         color: "rgba(26,18,8,0.55)",
         textTransform: "uppercase",
       }}
     >
       {screenshots.length > 0 ? "Your Goal / Direction (optional)" : "Their Message / Context"}
     </label>
     <textarea
       ref={theirMessageRef}
       value={theirMessage}
       onChange={(e) => {
         setTheirMessage(e.target.value);
         e.target.style.height = "auto";
         e.target.style.height = `${e.target.scrollHeight}px`;
       }}
       placeholder={
         screenshots.length > 0
           ? "Private note for your wingman — e.g., 'match her energy', 'tease her about being late', 'steer toward drinks'..."
           : "Paste their message or describe the situation..."
       }
       ...
     />
     ```
   - Collapse the draft box behind a toggle when `!showDraftBox && !yourDraft.trim()`:
     ```tsx
     {!showDraftBox && !yourDraft.trim() ? (
       <button
         type="button"
         onClick={() => setShowDraftBox(true)}
         className="mt-3 cursor-pointer"
         style={{
           fontFamily: "'DM Sans', sans-serif",
           fontSize: 12.5,
           fontWeight: 500,
           color: "#C8522A",
           background: "none",
           border: "none",
           padding: "4px 0",
         }}
       >
         + Test a reply you're thinking of sending
       </button>
     ) : (
       <div className="mt-3 relative">
         ...existing Your Potential Reply textarea...
       </div>
     )}
     ```

3. **Progressive Loading Copy (`lines 651-675`)**:
   - Track `loadingStep` (`0..3`) with a timer while `isLoading === true`:
     ```ts
     const LOADING_MESSAGES = [
       "Reading the screenshots & message flow...",
       "Picking up the subtext & relationship dynamic...",
       "Writing 15 replies across Real, Smooth, Playful, Bold & Your Style...",
       "Polishing the sharpest angles — almost ready...",
     ];
     ```
     Render `LOADING_MESSAGES[loadingStep]` in the loading view (`line 654`).

4. **Results View & Sticky Bottom Bar (`lines 750-868`)**:
   - Replace `<ReadStrip ghostRisk={ghostRisk} riskColor={riskColor} result={result} scrollFade={stripFade} />` (`line 750`) with `<FriendSummaryCard result={result} />`.
   - Inside the `"Their message"` `<DisclosureCard>` (`lines 752-803`), remove the `result?.detectedMeta` pills block (`lines 769-802`) so it only displays the clean `extractedUnrepliedMessages` list.
   - Remove the separate `"Your draft"` `<DisclosureCard>` (`lines 805-815`) completely, since `FriendSummaryCard` (`result.summary`) now critiques any user draft directly in plain talk.
   - Change `fixed bottom-20` on the sticky action bars (`line 625` and `line 817`) to `fixed bottom-[60px]` so the bar sits flush above the `60px` `TabBar` instead of floating with a 20px gap.
   - In the fixed bottom bar (`lines 818-827`), add the `ThumbsDown` button right next to `ThumbsUp`:
     ```tsx
     <button
       onClick={() => handleFeedback("helpful")}
       aria-label="Helpful reply"
       className="cursor-pointer"
       style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: feedbackGiven === "helpful" ? "#7A9E7E" : "rgba(26,18,8,0.45)" }}
     >
       <ThumbsUp size={19} strokeWidth={2} fill={feedbackGiven === "helpful" ? "#7A9E7E" : "none"} />
     </button>
     <button
       onClick={() => handleFeedback("off")}
       aria-label="Not helpful"
       className="cursor-pointer"
       style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: feedbackGiven === "off" ? "#C8522A" : "rgba(26,18,8,0.45)" }}
     >
       <ThumbsDown size={19} strokeWidth={2} fill={feedbackGiven === "off" ? "#C8522A" : "none"} />
     </button>
     ```
   - When calling `createSession` (`lines 246-251`), pass `ghost_risk: response.summary ? undefined : derivedGhostRisk` so V2 sessions store `NULL` in D1 `sessions.ghost_risk` instead of a meaningless `50`.

---

### Step 6: Update `app/components/HistoryScreen.tsx` for V2 + V1 Replay Parity

In `app/components/HistoryScreen.tsx`:
1. In `SessionDetail` (`lines 84-90`), normalize `suggestions` through `normalizeQuickAdvice({ suggestions })` (or resolve `real || authentic`, `playful || witty`, `bold || roast`) so both V2 (`real`, `smooth`, `playful`, `bold`, `yourStyle`) and legacy V1 sessions display all 5 tone tabs seamlessly.
2. When rendering reply bubbles inside `SessionDetail`, guard the quoted `originalMessage` line so it only renders when `r.originalMessage && r.originalMessage.trim().length > 0`.
3. Only render the `{risk}% risk` badge (`lines 201-214` and `1175-1188`) when `typeof session.ghost_risk === "number" || typeof session.parsedResult?.analysis?.ghostRisk === "number"`.

---

## Test Plan

1. **Typecheck & Unit Tests**:
   ```bash
   npm run typecheck && npm test
   ```
   Must exit 0 with all tests passing.
2. **Production Build**:
   ```bash
   npm run build
   ```
   Confirm `ReadStrip.tsx` is deleted with zero broken imports.

---

## Done Criteria

- [ ] `app/utils/quickLogic.ts`, `ToneRail.tsx`, and `QuickModeScreen.tsx` use the V2 tone order `Real · Smooth · Playful · Bold · Your Style` (`real`, `smooth`, `playful`, `bold`, `yourStyle`) with `Real` selected by default.
- [ ] `ReplyHeroCard.tsx` hides empty `""` quote lines when `originalMessage` is `""`.
- [ ] `app/components/quick/ReadStrip.tsx` is deleted and replaced by `app/components/quick/FriendSummaryCard.tsx`.
- [ ] `QuickModeScreen.tsx` switches input label between `"Your Goal / Direction (optional)"` (with screenshots) and `"Their Message / Context"` (without screenshots), collapses the draft box behind a toggle, shows progressive loading copy, and renders both `ThumbsUp` and `ThumbsDown` in the bottom bar.
- [ ] `HistoryScreen.tsx` replays both V2 and legacy V1 sessions cleanly and hides the `% risk` badge when `ghost_risk` is null.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` all exit 0.

---

## STOP Conditions

- **STOP** if `ReplyHeroCard.tsx` or `HistoryScreen.tsx` renders literal `""` above bubbles whose `originalMessage` is empty.
- **STOP** if `sessionStorage` carrying an old `"Authentic"` or `"Witty"` `quick_tone` value causes `selectedOptions` in `QuickModeScreen.tsx` to return `[]` — always coerce invalid `activeTone` values to `"Real"`.
