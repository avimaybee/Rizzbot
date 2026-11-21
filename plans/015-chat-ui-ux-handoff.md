# Plan 015A · Rizzbot Chat UI and UX handoff

Read the [architecture](../docs/10_CONVERSATIONAL_APP_VISION.md) and [implementation plan](./015-rizzbot-chat-implementation.md) before making changes. Use this document for screen layout, interaction, and exact UI copy. The architecture governs data and provider behavior. Implement Chat in the existing Rizzbot visual language.

## 1. Navigation and screens

| Entry | Destination and behavior |
| --- | --- |
| Signed-in landing | `/chat`, showing a new unsent conversation. Visiting it creates no server record. Preserve valid signed-in deep links through auth. |
| Open saved chat | `/chat/:threadId`. Reload opens the same thread. Back returns to the prior route. On mobile, opening the thread drawer leaves the current URL intact. |
| New chat | Opens `/chat`, clears the active reference, and puts focus on the composer after a keyboard-initiated action. The first accepted send creates the thread. |
| New menu → Incognito chat | Enters `/chat/incognito` with a fresh in-memory conversation. Reload opens a blank incognito screen. The desktop sidebar and mobile thread list never show incognito conversations. |
| Primary destinations | **Chat** and **Quick**. Quick links to `/quick`. Retain `/home` as a compatibility route. |
| Thread list footer | **History** → `/history`. **Settings** → `/settings`, with **Memory** linking to `/settings/memory` and the existing **My Voice** linking to `/voice`. History keeps existing record and replay behavior. Practice and Therapist leave primary navigation. Existing legacy deep links remain available while their data is reachable. |

On desktop, put Chat and Quick in the sidebar above **New chat** and the thread list. On mobile, use the Chat/Quick tab bar below the composer in Chat and the existing bottom-nav placement elsewhere. Hide the tab bar while the mobile keyboard is open inside Chat to keep the composer in view. The header’s **Chats** button opens the thread drawer. Keep Settings and History in the drawer footer. Nav items use links and the active destination exposes `aria-current="page"`.

## 2. Layout and styling

Use the existing paper canvas `#F5EFE6`, near-white surface `#FDFAF5`, ink `#1A1208`, divider `#E8E0D4`, and terracotta tint `#F5E8E0`. Reuse DM Sans for the interface and Cormorant Garamond for the new-chat heading. For solid controls with white text, use existing dark terracotta `#A8401C`. Use `#665A4E` for legible secondary text. Use divider as ornament and use a stronger border or focus ring where it communicates a control boundary. Scope Chat spacing and typography so the generic inline-style overrides in [index.css](../index.css) cannot shrink the composer.

| Part | Measurements |
| --- | --- |
| Chat shell | `100dvh`. Grid rows are header, `minmax(0, 1fr)` transcript, composer, and mobile nav as applicable. Only the transcript scrolls vertically. Honor safe insets on all four edges where applicable. Keep the composer and any focused field inside the visual viewport on iOS and Android. |
| Desktop ≥ 900px | 256px sidebar with a divider. Header and composer content centered in a 720px column. Horizontal gutter 24px. Sidebar thread list scrolls independently. |
| Mobile/tablet < 900px | Single column. Gutter 16px, 12px at ≤ 360px. Thread drawer width `min(320px, calc(100vw - 48px))`. Use a backdrop. Drawer contains its own scrollable list. |
| Header | At least 56px high plus top inset. Thread title one line with ellipsis. Use a native button for the overflow menu. Controls have at least 44×44px hit areas. |
| Transcript | 16px text at 1.5 line height, 12px between items in a turn, 24px between turns. User content right aligned in a tinted bubble capped at 85% width and 520px. Assistant prose left aligned directly on canvas and capped at 65ch. Cards are left aligned and can take the whole transcript width. Use `overflow-wrap: anywhere` for long unbroken text. |
| Composer | Near-white surface, 20px radius, 8px internal padding, top/bottom outer gap 8px. Textarea starts at one line with 16px input text and grows to 144px, then scrolls internally. Place Attach and Record at the left of the action row and Send at the right. |
| Empty page | Generous space around a 36px desktop or 32px mobile serif heading **What’s on your mind?** Composer stays at the bottom. Show no suggested prompts or promotional text. |
| Motion | Drawer and dialog may transition for 160ms ease-out. Stream text as it arrives and avoid animated layout shifts. Honor reduced motion by disabling transitions and smooth scrolling. |

Desktop wireframe, read top to bottom within each region.

```text
┌── Chat · Quick ──────┬── Thread title ──────────────── ⋯ ───┐
│ + New chat       ▾   │                                      │
│                      │                  User message bubble │
│ Saved conversation   │ Assistant text                       │
│ Saved conversation   │ [Reply card when requested]          │
│                      │                                      │
│                      │ [Jump to latest, only when needed]   │
│                      │ [attachment strip / reference]       │
│ History              │ [Message Rizzbot…]                   │
│ Settings             │ [Attach] [Record]             [Send] │
└──────────────────────┴──────────────────────────────────────┘
```

On mobile, replace the sidebar with a drawer and add **Chats** at the start of the header. A normal header title is **New chat** until the thread has a title. For image-only first turns use **New chat** as the saved title until renamed. For text first turns use the first line collapsed to a maximum of 56 characters. The incognito header reads **Incognito** and includes a visible **Close** action. Show **Uses saved memory. This chat won’t be saved.** in the incognito empty state and provide the same text in the header’s accessible description after send.

## 3. Composer and attachments

1. Placeholder **Message Rizzbot…**. Send is enabled for trimmed text or at least one ready image. Keep the original submitted wording, punctuation, emoji, and line breaks. Apply the text limit at 12,000 characters, with a count visible from 11,500. Reject overflow without truncating pasted text or silently dropping input.
2. On desktop, Enter sends and Shift+Enter inserts a newline. Skip keyboard submission while IME composition is active. On touch keyboards Return inserts a newline and the visible Send button submits. The composer stays editable for the next draft while a turn is running. The send control is visibly disabled until the current turn settles. Same-thread drafts may remain in mounted memory during the app visit. Clear that memory on sign-out, deletion, or incognito exit.
3. **Attach images** opens a multiple image picker. Pasting an image into the composer appends it and preserves any plain text present. Use the [existing optimizer](../app/utils/imageOptimize.ts). Preserve selection order and show numeric image labels so the user can refer to “image two.” Thumbnails are 56px squares with an independent labelled remove button and an overflow scroll strip. Open on tap, Enter, or Space.
4. Display up to 10 images and an 8 MiB combined limit after optimization. If only some pasted items fit, accept the valid ones in order and state how many were skipped and why. Optimization failures show **Couldn’t open image {n}. Try a PNG, JPEG, or WebP.** Keep other images and the draft. Disable Send while an item is being prepared. After a remove, number the remaining images in order. A sent turn’s numbering stays stable.
5. Preview in a lightbox with the image contained inside the viewport, close/previous/next controls, and the counter **Image {n} of {total}**. Escape closes and restores focus to the originating thumbnail. The first and last images have the appropriate navigation control disabled. Allow browser zoom. If a sent image can’t be loaded, keep its place and show **Image {n} unavailable** in the frame.
6. **Record voice** invokes the existing recorder. Recording replaces the composer action row with elapsed time, **Cancel**, and **Transcribe**. Never auto-send. While transcribing show **Transcribing…**. Insert the transcript at the current cursor or append it with a newline when no cursor is available. Preserve existing draft and attachments on denial, cancel, or failure. The failed recording may be retried while still mounted. Use **Microphone access is off. You can still type.** or **Couldn’t transcribe that recording. Try again.**
7. Put **Draft replies** in a composer action menu opened by a compact **More actions** button beside Record. Selecting it sets a one-send action and shows a removable **Draft replies** chip above the field. It preserves the draft, focuses the composer on keyboard activation, and uses the same Send button and validation as ordinary chat. It never auto-sends the contents. Clear it after acceptance, or let the user remove it before sending.
8. An active card/bubble reference sits above the input as **Refining {tone} · Option {n}** or **Refining {tone} · Option {n}, line {n}** and has a named clear button. A card-level action without an active option uses **Refining reply card**. Actions focus the composer without overwriting a typed draft. Selecting Refine replaces the Draft replies chip. Send requires an instruction or attachment. The full reference is sent as the source turn ID and option coordinates. Missing references show **That reply is no longer available.** and leave the draft intact.

## 4. Turns, scroll, and streaming

Show each user message once with its images in send order. A new send scrolls to the user’s latest message. Auto-follow new assistant content only while the user is within 80px of the bottom. Scrolling up pauses follow and shows **Jump to latest**. Clicking it restores follow. Loading older turns preserves the first visible item’s offset. Opening an existing thread starts at its newest turn.

| State | Visible behavior |
| --- | --- |
| Preparing local input | Keep text in the composer during validation and regular attachment upload. Show **Adding images…** when uploading. Prevent double submit. |
| Accepted | Show the user turn in the transcript and clear the sent draft. Show a quiet assistant activity line **Thinking…**. Clear only after acceptance or a GET confirms the submitted turn ID exists. |
| Text streaming | Replace the activity line with assistant prose. Preserve paragraph breaks. Render safe Markdown suitable for chat, with raw HTML disabled and links handled safely. Use normal text selection. |
| Drafting or refining | Show **Drafting replies…** or **Reworking that line…** in the same turn. Keep a short preamble only when it reads naturally above the final card. Do not render partial tool data. |
| Complete | Replace the provisional view with the saved turn. A text answer can stand on its own. The reply card appears once with the final result. |
| Connection interrupted | Look up the existing turn before offering Retry. If complete, replace the partial result with the saved result. If pending, show **Checking your message…** until it resolves or expires. |
| Failed after acceptance | Keep the sent bubble and replace the pending assistant view with **Couldn’t finish that reply.** and **Retry** for the latest failed turn. For an older failed turn show **Send again** to restore its input as a new draft without overwriting a nonempty draft. |
| Failed before acceptance | Keep the draft and show **Couldn’t send your message. Try again.** Reuse the same turn ID only for the same input. |
| Allowance or rate limit | Keep the unsent draft or failed turn. Use **Chat is at its usage limit. Try again later.** Do not silently switch to a provider with different data rules. |
| Thread history load fails | Use **Couldn’t load this chat.** with a Retry button. A missing or inaccessible thread gets **This chat isn’t available.** and **Back to chats**. |

Do not display provider/model labels, internal reasoning, a token counter, percent progress, or a mode switch. Announce significant state changes in a polite live region once per transition. Keep streaming tokens outside the live region and announce “Reply ready” once on completion. Do not steal focus when tokens arrive or when the user switches threads. Disregard late events from a different route, UID, or incognito session.

## 5. Inline reply cards

Render a full card only for an actual request to draft replies. Image-only prompts are ordinary conversation. For unclear intent, one short question is enough. Use the existing [Quick components](../app/components/quick). Wrap them in a Chat card keyed by the saved turn and reuse their result shapes and copy helpers. Preserve their existing standalone Quick behavior.

- Tone order **Real**, **Smooth**, **Playful**, **Bold**, **Your Style**. Default to Real or the first available tone when Real has no valid option. Keep tone selection and the picked tray isolated per card during the visit. Changing tone does not drop picked lines. At narrow widths, the tone rail scrolls horizontally and scrolls its active item into view. Avoid clipping focus outlines.
- Show one option at a time with previous/next and the existing option count. Preserve the current option for each tone within that card. Mobile touch and keyboard users can reach all options through buttons. Keep tone pickers, copy buttons, feedback, and refine as separate controls with no nested buttons.
- **Copy line** copies exactly that bubble. **Copy reply** follows the existing option copy helper and label behavior. **Copy picked lines** preserves picking order with blank lines between lines. No labels, tone prefixes, or emoji are added by the clipboard action. Show **Copied** for 1.5s only after success. On failure show **Couldn’t copy. Select the text to copy it.** Keep the text selectable.
- **Refine** for the whole card or specific line preloads a reference. A revision appears as a compact new answer with copy controls, beneath the user’s revision request. Keep the original card available. A normal conversation, screenshot interpretation, or deeper emotional advice stays prose.
- Do not save votes or picked lines from incognito. For regular Chat, v1 only needs in-memory picks and copy. Do not add a new feedback persistence system. Offer no outbound send, share automation, bulk texting, or simulated response from the other person.

## 6. Thread list, incognito, Settings

**Thread list.** Show most recently active first, with title and a relative timestamp. Use two separate controls for opening a row and its overflow menu. Keep unread markers out. Initially show 30, with **Load older chats** if more exist. Use **No saved chats yet** for the empty list. Rename dialog has a prefilled title, Cancel, and Save. Accept 1–56 characters after trimming. Delete dialog shows the thread title and **This removes the conversation and its screenshots. Saved memory stays.** Put focus on **Cancel** by default. Keep the row pending and visible until deletion succeeds. After deleting the active thread go to a fresh Chat. A failed deletion offers Retry and keeps the memory reassurance.

**Incognito.** Use the same layout and paper palette, with a small lock icon alongside the Incognito text. Use an isolated in-memory store. Switching to any other destination discards a nonempty incognito conversation or draft after confirming **Leave incognito chat?** with **Stay** and **Leave chat**. Escape cancels the dialog. A browser reload or closing the tab discards it. When Go processes content, its retention policy applies. Put that explanation under the incognito info action. After closing, return to the last regular chat in the current visit or a blank Chat.

**Settings → Memory.** Use the regular paper UI. Header **Memory**. Intro **Things Rizzbot can remember across your chats. You can change or remove any of them.** If empty, show **No saved memories yet.** plus **Add memory**. Rows show full wrapped notes and named **Edit memory** and **Delete memory** actions. Use one inline editor or dialog shared by add/edit. Text limit 250 characters, with a count in the editor. Optional label can be omitted. Save validates and remains disabled for whitespace-only text. Show **Memory saved** or **Memory deleted** after the server responds. If the revision changed, retain the draft and show **Memory changed in another chat. Review the latest version before saving.** Offer reload of the list without wiping the draft. Confirm **Clear all memory?** with **This removes saved memory. Your chats stay.** Clear remains distinct from thread deletion. At 40 entries disable adding and explain **Memory is full. Remove an entry to add another.**

## 7. Accessibility and visual acceptance

- Use a labelled thread list, one main heading, visible keyboard focus, semantic buttons for actions, and a properly labelled form. Use roving keyboard focus and arrow/Home/End support if using tab semantics on the tone rail. Dialogs trap focus, close on Escape, and restore focus. Keep selected/disabled/error states distinguishable in text or iconography.
- Check at 320×568, 390×844, 768×1024, and 1440×900. Test portrait and landscape phone keyboard, safe areas, 200% zoom, reduced motion, long Hinglish and emoji drafts, and a mixed screenshot-and-text paste. Verify the main canvas has no horizontal overflow.
- Capture new chat, active thread, Reply Card with picks, mobile keyboard open, incognito, Settings → Memory conflict, and interrupted draft states. Compare against this spec and fix any overlap, invisible focus, unreachable action, or layout shift before calling the UI complete.
- Walk through the reference journey on a phone and desktop: attach two images → ask about image two → ask what to say → switch tones → copy two picked lines → refine one line → reload regular chat → open incognito and recall saved memory → close it → edit memory. Back and reload must behave as described above.
