# Plan 013 — Passive Voice Learning from Screenshots & `MyVoiceScreen` Quiz Fix

> **Before you start — drift check.** This plan was written against commit `c7728b1` (`main`) and assumes Plans 010–012 are applied. Before touching anything, run:
>
> ```bash
> git log --oneline c7728b1..HEAD -- types.ts app/components/MyVoiceScreen.tsx functions/api/style_profiles.ts functions/api/schema.ts services/dbService.ts app/app-context.tsx
> ```
>
> If unexpected changes exist, **STOP and read the diff** before applying edits. All symbol names, D1 columns, and line numbers below are verified against `c7728b1`.

## Status

- **Priority**: P1 (fixes the `MyVoiceScreen` quiz bug and enables passive voice learning from the user's own bubbles in Quick Mode screenshots)
- **Effort**: ~3–4 hours
- **Depends on**: Plan 010 (`formatAbstractUserStyle` in `services/geminiService.ts`)
- **Risk**: Low-Medium (adds D1 columns to `style_profiles` via `ensureAppSchema(db)` in `functions/api/schema.ts` + `d1_migrations/007_passive_voice_learning.sql`, and adds a non-blocking `POST /api/voice/learn` endpoint)

---

## Why this matters

Currently, the `"Your Style"` tab and `MyVoiceScreen.tsx` have a severe bug that pollutes `"Your Style"` with developer-written multiple-choice button labels:

1. **The `MyVoiceScreen.tsx` Quiz Bug (`app/components/MyVoiceScreen.tsx:66-96`)**:
   - Look at `profileFromAnswers(answers: number[])` in `app/components/MyVoiceScreen.tsx:76-80, 94`:
     ```ts
     const signaturePatterns = [
       questions[4].options[answers[4] ?? 0], // e.g. "React to story" or "Meme/link"
       questions[0].options[answers[0] ?? 0], // e.g. "Match their energy" or "Wait even longer"
       questions[5].options[answers[5] ?? 0], // e.g. "Let it fade" or "Send clear wrap-up"
     ];
     ```
     And then line 88 sets `signaturePatterns` and line 94 sets `rawSamples: signaturePatterns`!
   - Those strings (`"React to story"`, `"Match their energy"`, `"Let it fade"`) are **UI button descriptions of behaviors**, NOT text messages!
   - Saving them into `signaturePatterns` and `rawSamples` causes `MyVoiceScreen.tsx:165` (`const seed = userProfile?.rawSamples?.slice(0, 6) || []`) to pre-fill the user's text sample boxes with `"React to story"` and `"Match their energy"`, and previously caused Quick Mode to inject them as literal signature phrases!
2. **Zero-Click Passive Voice Learning from Quick Mode Screenshots**:
   - Every time a user runs Quick Mode with screenshots, their own outgoing messages (right-side bubbles on iMessage/Instagram/WhatsApp/Hinge/Tinder, or `"Me"` bubbles on Snapchat) are right there in the image.
   - By running a fire-and-forget background request (`POST /api/voice/learn`) after Quick Mode completes, we can:
     1. Extract ONLY the user's own outgoing bubbles using an ultra-cheap/free OpenCode Go vision model (`muse-spark-1.3-contributor` at `effort: "low"` → fallback `hy4-flash-free` at `reasoning_effort: "high"`).
     2. Merge and deduplicate them into a rolling 40-message window (`learned_samples` in D1 `style_profiles`).
     3. Distill an abstract **cadence description** (`cadence_notes`, e.g., *"Writes 3–6 word lowercase bursts, uses 'wait' or 'nah' as dry pivots, skips trailing periods, rarely uses emojis"*) and update `userProfile` in `useAppContext()` automatically.

---

## Current state (verified at `c7728b1`)

1. **`app/components/MyVoiceScreen.tsx:66-96`**:
   - `profileFromAnswers(answers)` sets `signaturePatterns` (lines 76–80) and `rawSamples: signaturePatterns` (line 94) to the quiz option labels (`questions[4].options[...]`, `questions[0].options[...]`, `questions[5].options[...]`).
2. **`types.ts:64-80`**:
   - `UserStyleProfile` has `emojiUsage`, `capitalization`, `punctuation`, `averageLength`, `slangLevel`, `signaturePatterns`, `preferredTone`, `energy`, `responseSpeed`, `flirtLevel`, `humorStyle`, `aiSummary`, `favoriteEmojis`, `rawSamples`.
3. **`functions/api/schema.ts:116-145, 238`**:
   - Exports `ensureAppSchema(db)` (line 238).
   - `style_profiles` table has columns: `id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, emoji_usage TEXT, capitalization TEXT, punctuation TEXT, average_length TEXT, slang_level TEXT, signature_patterns TEXT, preferred_tone TEXT, raw_samples TEXT, ai_summary TEXT, favorite_emojis TEXT, response_speed TEXT, flirt_level TEXT, humor_style TEXT, energy TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
4. **`functions/api/style_profiles.ts:1-161`**:
   - Uses `ensureAppSchema(db)` and maps `verifiedUid = data?.user?.uid` to `dbUserId` via `SELECT id FROM users WHERE anon_id = ?`.
   - `GET` returns `SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`.
   - `POST` inserts a new row into `style_profiles`.
5. **`app/app-context.tsx:67-82, 176-204`**:
   - `mapDbProfileToUserProfile(profile)` maps snake_case D1 columns from `style_profiles` to `UserStyleProfile`.
   - `saveUserProfile(profile)` calls `saveStyleProfile(...)` in `services/dbService.ts` and updates `userProfile` state.

---

## Scope

### Files to create
1. `d1_migrations/007_passive_voice_learning.sql` — SQL migration adding `learned_samples TEXT DEFAULT '[]'`, `cadence_notes TEXT DEFAULT ''`, `sample_count INTEGER DEFAULT 0`, and `updated_at TIMESTAMP` to `style_profiles`.
2. `functions/api/voice/learn.ts` — Authenticated Cloudflare Pages Function (`POST /api/voice/learn`) that extracts the user's outgoing messages from 1–3 Quick Mode screenshots via OpenCode Go (`muse-spark-1.3-contributor:low` → `hy4-flash-free:high`), merges them into the user's latest `style_profiles` row in D1 (up to 40 deduplicated messages), synthesizes abstract `cadence_notes`, and returns the updated D1 profile row.
3. `services/voiceLearningService.ts` — Frontend helper `triggerPassiveVoiceLearning(screenshots)` that calls `POST /api/voice/learn` with `getFirebaseToken()` from `./firebaseService` in the background (never blocking Quick Mode UI).

### Files to modify
1. `types.ts` — Add optional `learnedSamples?: string[]`, `cadenceNotes?: string`, and `sampleCount?: number` to `UserStyleProfile` (`lines 64-80`).
2. `functions/api/schema.ts` — Add `learned_samples`, `cadence_notes`, `sample_count`, and `updated_at` to `style_profiles` in `ensureSchemaInternal` (`lines 118-145`).
3. `functions/api/style_profiles.ts` — Include `learned_samples`, `cadence_notes`, and `sample_count` in `POST /api/style_profiles` (preserving existing learned samples from the user's previous `style_profiles` row if not explicitly provided in `body`).
4. `services/dbService.ts` — Allow `saveStyleProfile` payload to include optional `learned_samples`, `cadence_notes`, and `sample_count`.
5. `app/app-context.tsx` — Map `learned_samples`, `cadence_notes`, and `sample_count` in `mapDbProfileToUserProfile` (`lines 67-82`) and pass them through in `saveUserProfile` (`lines 176-204`).
6. `app/components/MyVoiceScreen.tsx` —
   - Fix `profileFromAnswers` (`lines 76-95`) so `signaturePatterns: []` and `rawSamples: []` (never saving quiz button labels!).
   - Display a `"Learned from your screenshots"` status card when `(userProfile?.sampleCount ?? 0) > 0` showing `userProfile.sampleCount` and `userProfile.cadenceNotes`.
7. `app/components/QuickModeScreen.tsx` — After `getQuickAdvice` succeeds when `screenshots.length > 0`, fire `void triggerPassiveVoiceLearning(screenshots)` in the background.

---

## Step-by-Step Implementation Instructions

### Step 1: Fix `profileFromAnswers` in `app/components/MyVoiceScreen.tsx:66-96`

In `app/components/MyVoiceScreen.tsx`, replace lines 76–96 inside `profileFromAnswers` with:

```ts
  return {
    emojiUsage,
    capitalization: "lowercase",
    punctuation: "minimal",
    averageLength,
    slangLevel: "casual",
    signaturePatterns: [],
    preferredTone,
    responseSpeed,
    flirtLevel,
    humorStyle,
    aiSummary: `you text ${preferredTone} with ${averageLength} messages and ${emojiUsage} emoji use`,
    rawSamples: [],
  };
```

Also add a clean sanitation filter on `MyVoiceScreen.tsx:164-168` so if an existing user already has the old quiz button labels (`"React to story"`, `"Match their energy"`, `"Keep it short and calm"`, `"Wait even longer"`, `"Bring the heat immediately"`, `"How's your day?"`, `"Meme/link"`, `"Bold direct opener"`, `"Let it fade"`, `"Talk later message"`, `"Stop replying"`, `"Send clear wrap-up"`) saved in `userProfile.rawSamples`, those quiz option labels are filtered out when seeding `sampleTexts`!

---

### Step 2: Update `types.ts`, `d1_migrations/007_passive_voice_learning.sql`, `functions/api/schema.ts`, `functions/api/style_profiles.ts`, and `app/app-context.tsx`

#### 2A. Update `UserStyleProfile` in `types.ts:64-80`

```ts
export interface UserStyleProfile {
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
  capitalization: 'lowercase' | 'normal' | 'mixed';
  punctuation: 'none' | 'minimal' | 'full';
  averageLength: 'short' | 'medium' | 'long';
  slangLevel: 'formal' | 'casual' | 'heavy-slang';
  signaturePatterns: string[]; // ["haha", "lol", "..."]
  preferredTone: 'playful' | 'chill' | 'direct' | 'sweet';
  // Extended fields for richer personalization
  energy?: 'low' | 'medium' | 'high';
  responseSpeed?: 'instant' | 'normal' | 'slow';
  flirtLevel?: 'none' | 'subtle' | 'moderate' | 'bold';
  humorStyle?: 'dry' | 'playful' | 'sarcastic' | 'wholesome';
  aiSummary?: string;
  favoriteEmojis?: string[];
  rawSamples?: string[];
  // Passive screenshot voice learning fields (Plan 013)
  learnedSamples?: string[];
  cadenceNotes?: string;
  sampleCount?: number;
}
```

#### 2B. Create `d1_migrations/007_passive_voice_learning.sql` & Update `functions/api/schema.ts:116-145`

Create `d1_migrations/007_passive_voice_learning.sql`:
```sql
ALTER TABLE style_profiles ADD COLUMN learned_samples TEXT DEFAULT '[]';
ALTER TABLE style_profiles ADD COLUMN cadence_notes TEXT DEFAULT '';
ALTER TABLE style_profiles ADD COLUMN sample_count INTEGER DEFAULT 0;
ALTER TABLE style_profiles ADD COLUMN updated_at TIMESTAMP;
```

In `functions/api/schema.ts:138-145`, add the 4 idempotent `runSchemaStatement` calls right after line 144:
```ts
  await runSchemaStatement(db, `ALTER TABLE style_profiles ADD COLUMN learned_samples TEXT DEFAULT '[]'`);
  await runSchemaStatement(db, `ALTER TABLE style_profiles ADD COLUMN cadence_notes TEXT DEFAULT ''`);
  await runSchemaStatement(db, `ALTER TABLE style_profiles ADD COLUMN sample_count INTEGER DEFAULT 0`);
  await runSchemaStatement(db, `ALTER TABLE style_profiles ADD COLUMN updated_at TIMESTAMP`);
```

#### 2C. Update `app/app-context.tsx:30-45, 67-82, 161-205`

1. In `mapDbProfileToUserProfile` (`app/app-context.tsx:67-82`), map the 3 new fields:
   ```ts
     learnedSamples: parseJsonArray(profile.learned_samples),
     cadenceNotes: (profile.cadence_notes as string | undefined) || undefined,
     sampleCount: typeof profile.sample_count === "number" ? profile.sample_count : 0,
   ```
2. Export `mapDbProfileToUserProfile` and add `refreshUserProfile: () => Promise<void>` to `AppContextValue` (`app/app-context.tsx:30-45`) so that after `triggerPassiveVoiceLearning(screenshots)` updates D1 in the background, `QuickModeScreen.tsx` can call `void refreshUserProfile()` to update `userProfile` in memory (and `localStorage`) immediately for the very next Quick Mode run without needing a page reload:
   ```ts
   const refreshUserProfile = useCallback(async () => {
     if (!userId || !authUser) return;
     try {
       const profile = await getStyleProfile(userId);
       if (profile) {
         const mapped = mapDbProfileToUserProfile(profile as unknown as Record<string, unknown>);
         setUserProfile(mapped);
         try {
           localStorage.setItem(`userStyleProfile_${authUser.uid}`, JSON.stringify(mapped));
         } catch {
           // Ignore localStorage quota warnings
         }
       }
     } catch {
       // Non-fatal background sync error
     }
   }, [userId, authUser]);
   ```

---

### Step 3: Create `functions/api/voice/learn.ts`

Create `functions/api/voice/learn.ts` (`POST /api/voice/learn`):

```ts
import { ensureAppSchema } from "../schema";

const MAX_LEARNED_SAMPLES = 40;

const VOICE_LEARN_SI = `You analyze chat screenshots to learn how the USER (the person who took the screenshot) texts.

1. IDENTIFY THE USER'S OWN MESSAGES ONLY:
- In iMessage, Instagram, WhatsApp, Hinge, Tinder, Telegram: the user's messages are the RIGHT-SIDE bubbles.
- In Snapchat: the user's messages are labeled "Me" (red/pink or blue vertical bar labeled "Me").
- NEVER extract messages sent by the other person. If no user messages are visible, return an empty array for userMessages.

2. SYNTHESIZE ABSTRACT CADENCE (NO CATCHPHRASE COPYING):
- Given the user's visible messages (plus any previously learned samples provided in the prompt), infer their structural texting habits:
  * emojiUsage: "none" | "minimal" | "moderate" | "heavy"
  * capitalization: "lowercase" | "normal" | "mixed"
  * punctuation: "none" | "minimal" | "full"
  * averageLength: "short" | "medium" | "long"
  * slangLevel: "formal" | "casual" | "heavy-slang"
  * preferredTone: "playful" | "chill" | "direct" | "sweet"
  * energy: "low" | "medium" | "high"
  * humorStyle: "dry" | "playful" | "sarcastic" | "wholesome"
  * cadenceNotes: 1-2 sentences describing HOW they structure thoughts, sentence length, fragments, capitalization, Hinglish/slang ratio, and humor rhythm. NEVER tell the AI to repeat specific words or catchphrases.

OUTPUT ONLY RAW VALID JSON matching:
{
  "userMessages": ["string"],
  "emojiUsage": "minimal",
  "capitalization": "lowercase",
  "punctuation": "minimal",
  "averageLength": "short",
  "slangLevel": "casual",
  "preferredTone": "chill",
  "energy": "medium",
  "humorStyle": "dry",
  "cadenceNotes": "string"
}`;

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      return [];
    }
  }
  return [];
}

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request, data } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const verifiedUid = data?.user?.uid as string | undefined;
  if (!verifiedUid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1;
  const apiKey = env.OPENCODE_GO_API_KEY;
  if (!db || !apiKey) {
    return new Response(JSON.stringify({ updated: false, reason: "DB or API key unavailable" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    await ensureAppSchema(db);
    await db.prepare("INSERT OR IGNORE INTO users (anon_id) VALUES (?)").bind(verifiedUid).run();
    const userRow = await db.prepare("SELECT id FROM users WHERE anon_id = ?").bind(verifiedUid).first();
    const dbUserId = userRow?.id;
    if (!dbUserId) {
      return new Response(JSON.stringify({ updated: false }), { status: 200, headers: corsHeaders });
    }

    const body = (await request.json()) as { screenshots?: string[] };
    const screenshots = Array.isArray(body.screenshots) ? body.screenshots.slice(0, 3) : [];
    if (screenshots.length === 0) {
      return new Response(JSON.stringify({ updated: false }), { status: 200, headers: corsHeaders });
    }

    const existingProfile = await db
      .prepare("SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(dbUserId)
      .first();

    const existingLearned = parseJsonArray(existingProfile?.learned_samples);
    const prompt = `Extract the user's own sent messages from these ${screenshots.length} screenshot(s) and update their abstract cadence profile.\nPreviously learned user messages (${existingLearned.length}): ${JSON.stringify(existingLearned.slice(-20))}`;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Rizzbot/1.0",
      "x-opencode-session": `rizzbot-vlearn-${verifiedUid}-${Date.now()}`,
    };

    let rawText = "";
    // Primary: muse-spark-1.3-contributor (low)
    try {
      const contentParts: Array<Record<string, unknown>> = screenshots.map((s) => ({
        type: "input_image",
        image_url: s.startsWith("data:") ? s : `data:image/webp;base64,${s}`,
      }));
      contentParts.push({ type: "input_text", text: prompt });

      const res = await fetch("https://opencode.ai/inference/go/openai/v1/responses", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "muse-spark-1.3-contributor",
          instructions: VOICE_LEARN_SI,
          input: [{ role: "user", content: contentParts }],
          reasoning: { effort: "low" },
          text: { format: { type: "json_object" } },
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ text?: string }> }> };
        rawText = j.output_text || j.output?.filter((o) => o.type === "message").flatMap((o) => o.content?.map((c) => c.text || "") || []).join("") || "";
      }
    } catch {
      // Fall through to free hy4-flash-free
    }

    if (!rawText.trim()) {
      const userContent: Array<Record<string, unknown>> = screenshots.map((s) => ({
        type: "image_url",
        image_url: { url: s.startsWith("data:") ? s : `data:image/webp;base64,${s}` },
      }));
      userContent.push({ type: "text", text: prompt });

      const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "hy4-flash-free",
          reasoning_effort: "high",
          messages: [
            { role: "system", content: VOICE_LEARN_SI },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        rawText = j.choices?.[0]?.message?.content || "";
      }
    }

    if (!rawText.trim()) {
      return new Response(JSON.stringify({ updated: false }), { status: 200, headers: corsHeaders });
    }

    const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    const newMsgs = Array.isArray(parsed.userMessages)
      ? parsed.userMessages
          .filter((m): m is string => typeof m === "string" && m.trim().length >= 3)
          .map((m) => m.trim())
      : [];

    if (newMsgs.length === 0) {
      return new Response(JSON.stringify({ updated: false, reason: "No user messages in screenshot" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Deduplicate case-insensitively while keeping chronological order (latest 40)
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const msg of [...existingLearned, ...newMsgs]) {
      const norm = msg.toLowerCase().trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        merged.push(msg);
      }
    }
    const finalSamples = merged.slice(-MAX_LEARNED_SAMPLES);
    const cadenceNotes =
      typeof parsed.cadenceNotes === "string" && parsed.cadenceNotes.trim()
        ? parsed.cadenceNotes.trim()
        : (existingProfile?.cadence_notes as string) || "";

    await db
      .prepare(
        `INSERT INTO style_profiles
         (user_id, emoji_usage, capitalization, punctuation, average_length, slang_level, signature_patterns, preferred_tone, raw_samples, ai_summary, favorite_emojis, response_speed, flirt_level, humor_style, energy, learned_samples, cadence_notes, sample_count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(
        dbUserId,
        (parsed.emojiUsage as string) || existingProfile?.emoji_usage || "minimal",
        (parsed.capitalization as string) || existingProfile?.capitalization || "lowercase",
        (parsed.punctuation as string) || existingProfile?.punctuation || "minimal",
        (parsed.averageLength as string) || existingProfile?.average_length || "short",
        (parsed.slangLevel as string) || existingProfile?.slang_level || "casual",
        "[]",
        (parsed.preferredTone as string) || existingProfile?.preferred_tone || "chill",
        existingProfile?.raw_samples || "[]",
        cadenceNotes || existingProfile?.ai_summary || null,
        existingProfile?.favorite_emojis || "[]",
        existingProfile?.response_speed || "normal",
        existingProfile?.flirt_level || "subtle",
        (parsed.humorStyle as string) || existingProfile?.humor_style || "dry",
        (parsed.energy as string) || existingProfile?.energy || "medium",
        JSON.stringify(finalSamples),
        cadenceNotes,
        finalSamples.length
      )
      .run();

    const updatedProfile = await db
      .prepare("SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(dbUserId)
      .first();

    return new Response(JSON.stringify({ updated: true, profile: updatedProfile }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.warn("[voice/learn] Non-fatal error:", err?.message);
    return new Response(JSON.stringify({ updated: false }), { status: 200, headers: corsHeaders });
  }
}
```

---

### Step 4: Create `services/voiceLearningService.ts` & Wire into `QuickModeScreen.tsx`

Create `services/voiceLearningService.ts`:

```ts
import { getFirebaseToken } from "./firebaseService";

/**
 * Fire-and-forget passive voice learning from Quick Mode screenshots.
 * Never throws or blocks Quick Mode results rendering.
 */
export async function triggerPassiveVoiceLearning(
  screenshots: string[],
  onUpdated?: () => void
): Promise<void> {
  if (!Array.isArray(screenshots) || screenshots.length === 0) return;

  try {
    const token = await getFirebaseToken();
    const res = await fetch("/api/voice/learn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        screenshots: screenshots.slice(0, 3),
      }),
    });

    if (!res.ok) return;
    const data = (await res.json()) as { updated?: boolean };
    if (data.updated && onUpdated) {
      onUpdated();
    }
  } catch {
    // Non-blocking background enhancement
  }
}
```

In `app/components/QuickModeScreen.tsx`, destructure `refreshUserProfile` from `useAppContext()` and inside `handleAnalyze` right after `setResult(response); setShowResults(true);`:
```ts
if (screenshots.length > 0 && authUser?.uid) {
  void triggerPassiveVoiceLearning(screenshots, () => {
    void refreshUserProfile();
  });
}
```

---

## Test Plan

1. **Typecheck & Unit Tests**:
   ```bash
   npm run typecheck && npm test
   ```
   Must exit 0.
2. **Quiz Regression Check**:
   - Verify `profileFromAnswers([0, 1, 2, 3, 0, 1])` in `MyVoiceScreen.tsx` produces `signaturePatterns: []` and `rawSamples: []`.

---

## Done Criteria

- [ ] `MyVoiceScreen.tsx` `profileFromAnswers` sets `signaturePatterns: []` and `rawSamples: []` and filters out legacy quiz option labels from `sampleTexts`.
- [ ] `d1_migrations/007_passive_voice_learning.sql` and `functions/api/schema.ts` (`ensureAppSchema`) add `learned_samples`, `cadence_notes`, `sample_count`, and `updated_at` to `style_profiles`.
- [ ] `functions/api/style_profiles.ts` and `app/app-context.tsx` map `learnedSamples`, `cadenceNotes`, and `sampleCount`.
- [ ] `functions/api/voice/learn.ts` extracts outgoing user messages via OpenCode Go (`muse-spark-1.3-contributor:low` → `hy4-flash-free:high`) and updates `cadence_notes` in D1.
- [ ] `QuickModeScreen.tsx` triggers `triggerPassiveVoiceLearning(screenshots)` asynchronously after screenshot runs.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` all exit 0.

---

## STOP Conditions

- **STOP** if `rawSamples` or `learnedSamples` literal strings are injected into the Quick Mode generation prompt — only abstract `cadenceNotes` and structural enum fields may be passed in `formatAbstractUserStyle`.
- **STOP** if `triggerPassiveVoiceLearning` is `await`ed before `setShowResults(true)` in `QuickModeScreen.tsx`.
