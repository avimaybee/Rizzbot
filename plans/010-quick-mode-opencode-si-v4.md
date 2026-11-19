# Plan 010 — Quick Mode OpenCode Go Backend, System Instruction v4.1 & V2 Bubble Normalization

> **Before you start — drift check.** This plan was written against commit `c7728b1` (`main`). Before touching anything, run:
>
> ```bash
> git log --oneline c7728b1..HEAD -- types.ts services/quickAdvice.ts services/quickAdvice.test.ts services/geminiService.ts services/feedbackService.ts app/utils/quickLogic.ts app/components/QuickModeScreen.tsx
> ```
>
> If any of those files changed since `c7728b1`, **STOP and read the diff** before applying edits. All symbol names and line numbers below are verified against `c7728b1`.

## Status

- **Priority**: P0 (foundational — Plans 011, 012, 013, and 014 build on this proxy and normalization layer)
- **Effort**: ~3–4 hours
- **Depends on**: None (can be executed first; maps V2 `{ real, smooth, playful, bold, yourStyle }` + `bubbles: [{ replyTo, text }]` cleanly into `SuggestionOption` `{ replies: [{ originalMessage, reply }], conversationHook: "" }` so all 14 existing tests in `services/quickAdvice.test.ts`, `QuickModeScreen.tsx`, and `HistoryScreen.tsx` compile and pass immediately)
- **Risk**: Low-Medium (adds `functions/api/opencode/quick.ts` and updates `services/quickAdvice.ts` + `getQuickAdvice` in `services/geminiService.ts`)

---

## Why this matters

Quick Mode (`getQuickAdvice` in `services/geminiService.ts:585-922`) currently suffers from four critical production failures:

1. **Gemini Quota Wall & Lite Model Degradation**:
   - `QUICK_MODE_MODELS` (`services/geminiService.ts:61-65`) starts with `"gemini-3.5-flash-lite"`, `"gemini-3-flash-preview"`, `"gemini-2.5-flash"`.
   - `gemini-3-flash-preview` has a hard 20 requests/day Free Tier limit (`GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20`), and `gemini-3.5-flash-lite` frequently misreads sender sides in screenshots, hallucinates unseen Snapchat snaps, and outputs sterile filler.
2. **Slang Spam & Over-Prescriptive Prompting**:
   - `buildQuickAdviceParts` (`services/geminiService.ts:685-700`) stuffs a huge vocabulary list (`"fr", "no cap", "bet", "ong", "lowkey", "icl", "bffr", "gng", "valid", "ate", "slay", "based", "real", "cooked", "unhinged", "delulu", "the ick", "rent free", "roman empire"`), causing models to output unnatural slang salads (`"wtf bro tbh icl lowkey cooked ngl lol fr"`).
   - Injecting `s.signaturePatterns.join(', ')` (`services/geminiService.ts:597`) injects developer-written quiz option strings from `MyVoiceScreen.tsx:76-80` (`"React to story"`, `"Match their energy"`), causing the AI to echo awkward phrases.
3. **16-Model × Thinking Tournament & 23-Ballot Blind Judge Panel**:
   - We benchmarked 16 ultra-affordable/free OpenCode Go model × thinking combinations across 4 real production D1 scenarios (`#153` text-only playful confrontation, `#156` unseen Instagram DM + 5 drool emojis, `#164` Snapchat snap + private "feeling sidelined" goal, `#166` Snapchat Hinglish 2-topic thread).
   - A 23-ballot blind judge panel across 7 distinct model families (`gemini-3.8-flash-high`, `gemini-4-hydrogen-high`, `muse-spark-1.3-high`, `glm-5.3-flash-high`, `hy4-flash-free-high`, `mimo-v2.6-flash`, `deepseek-v4.1-flash-high`) ranked all 16 entries with self-votes excluded:

| Rank | OpenCode Go Model | Thinking Effort | Endpoint Format | Self-Excl Borda % | External Gemini Borda % | Avg Score (/50) | Bottom-3 Finishes | Avg Latency | Cost / Call (Go Monthly Allowance) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **#1 (Primary)** | `muse-spark-1.3-contributor` | `xhigh` | `/v1/responses` | **70.9%** | **82.2% (#1)** | **38.3** (`40.0` Ext) | **0 / 23** | `52.3s` | **~$0.0014** ($60/mo ≈ 42,000+ calls/mo) |
| **#2 (Alt Fast)** | `muse-spark-1.3-contributor` | `medium` | `/v1/responses` | **69.1%** | **78.9% (#3)** | **38.6** (`39.6` Ext) | 1 / 23 | `34.1s` | **~$0.0011** ($60/mo ≈ 54,000+ calls/mo) |
| **#3 (Fallback 1)** | `deepseek-v4.1-flash` | `high` | `/v1/chat/completions` | **65.6%** | 65.8% | 34.4 | 1 / 23 | `39.0s` | **~$0.0010** ($100/mo ≈ 100,000 calls/mo, `zdr: true`) |
| **#4** | `muse-spark-1.3-contributor` | `high` | `/v1/responses` | **65.2%** | **80.9% (#2)** | 37.3 (`39.8` Ext) | **0 / 23** | `37.4s` | **~$0.0010** ($60/mo) |
| **#5 (Fallback 2)** | `hy4-flash-free` | `high` | `/v1/chat/completions` | **59.2%** | 56.6% | 35.1 | 3 / 23 | `56.7s` | **$0.0000 (FREE)** (`zdr: true`) |

4. **Cloudflare 524 Timeout Prevention via NDJSON Heartbeat Stream**:
   - Because `muse-spark-1.3-contributor` (`xhigh`) takes 35–67 seconds (and up to ~85 seconds with multiple screenshots), a synchronous JSON response risks hitting Cloudflare's 100s edge read timeout (`HTTP 524`).
   - `functions/api/opencode/quick.ts` must stream `application/x-ndjson` with a 10-second heartbeat (`{"type":"ping"}\n`).

---

## Current state (verified at `c7728b1`)

1. **`types.ts:64-80, 120-194, 227-260`**:
   - `UserStyleProfile` (lines 64–80) has fields: `emojiUsage`, `capitalization`, `punctuation`, `averageLength`, `slangLevel`, `signaturePatterns`, `preferredTone`, `energy`, `responseSpeed`, `flirtLevel`, `humorStyle`, `aiSummary`, `favoriteEmojis`, `rawSamples`.
   - `QuickAdviceRequest` (lines 120–127) has `{ theirMessage: string; yourDraft?: string; context?: 'stranger' | 'new' | 'talking' | 'dating' | 'complicated' | 'ex' | 'friends'; userStyle?: UserStyleProfile; screenshots?: string[]; userId?: string }`.
   - `MessageReply` (lines 132–135) has `{ originalMessage: string; reply: string }`.
   - `SuggestionOption` (lines 140–143) has `{ replies: MessageReply[]; conversationHook: string }`.
   - `QuickAdviceResponse` (lines 148–194) has `vibeCheck`, `extractedUnrepliedMessages`, `suggestions: { smooth, bold, witty, authentic, yourStyle, wait }`, `proTip`, `recommendedAction`, `degraded`.
   - `FeedbackEntry.suggestionType` (line 231) has `'smooth' | 'bold' | 'witty' | 'roast' | 'authentic' | 'safe' | 'spicy' | 'you' | 'yourStyle'`.
2. **`services/quickAdvice.ts:1-77` & `services/quickAdvice.test.ts:1-155`**:
   - Exports `FALLBACK_PRO_TIP`, `normalizeQuickAdvice(parsed)`, `buildQuickFallback()`, `isQuickAdviceDegraded(r)`, and `buildCopyPayload(option)`.
   - `services/quickAdvice.test.ts` has 14 unit tests testing `normalizeQuickAdvice`, `buildQuickFallback`, `isQuickAdviceDegraded`, and `buildCopyPayload`.
3. **`services/geminiService.ts:7, 585-922`**:
   - Uses `import { getFirebaseToken } from "./firebaseService";`.
   - Exports `getQuickAdvice(request: QuickAdviceRequest): Promise<QuickAdviceResponse>` (line 871) and `streamQuickAdvice(request: QuickAdviceRequest, onChunk: (text: string) => void): Promise<QuickAdviceResponse>` (line 928).
4. **`app/utils/quickLogic.ts:1-26`**:
   - Exports `TONE_ORDER = ["smooth", "bold", "witty", "authentic", "yourStyle"] as const` and `TONE_LABELS`.
5. **`functions/api/_middleware.ts:90-163`**:
   - Verifies Firebase ID token from `Authorization: Bearer <token>` and attaches `context.data.user = { uid: decodedToken.sub, email: ..., ... }` (lines 153–159).

---

## Scope

### Files to create
1. `functions/api/opencode/quick.ts` — Cloudflare Pages Function (`POST /api/opencode/quick`) embedding `QUICK_MODE_SI_V4_1` byte-for-byte, streaming `application/x-ndjson` with a 10-second heartbeat (`{"type":"ping"}\n`), and running the 3-model fallback chain (`muse-spark-1.3-contributor:xhigh` → `deepseek-v4.1-flash:high` → `hy4-flash-free:high`).

### Files to modify
1. `types.ts` — Extend `SuggestionOption` and `QuickAdviceResponse` to include V2 tone keys (`real?: SuggestionOption[]`, `playful?: SuggestionOption[]`) alongside `smooth`, `bold`, `witty`, `authentic`, `yourStyle`, plus optional V2 `summary?: string`, `shouldWait?: boolean`, and `modelUsed?: string`, and add `'real' | 'playful'` to `FeedbackEntry['suggestionType']`.
2. `services/quickAdvice.ts` — Upgrade `normalizeQuickAdvice(parsed)` so it seamlessly normalizes **both**:
   - **V2 OpenCode Go payloads**: `{ extractedUnrepliedMessages, suggestions: { real, smooth, playful, bold, yourStyle } (each with bubbles: [{ replyTo, text }]), summary, shouldWait }`, mapping each bubble `{ replyTo, text }` into `MessageReply` `{ originalMessage: replyTo || "", reply: text }` with `conversationHook: ""`, populating both `real`/`authentic` and `playful`/`witty`, mapping `summary` → `proTip` (and `summary`), and `shouldWait: true` → `recommendedAction: 'WAIT'` + `suggestions.wait = summary`.
   - **Legacy V1 payloads**: `{ suggestions: { smooth, bold, roast, witty, authentic, yourStyle } (each with replies: [{ originalMessage, reply }], conversationHook) }`, preserving 100% compatibility with all 14 existing unit tests in `services/quickAdvice.test.ts`!
3. `services/quickAdvice.test.ts` — Keep all 14 existing tests intact and add a `describe("V2 OpenCode Go multi-bubble payload normalization")` block testing `bubbles -> replies`, `real <-> authentic`, `playful <-> witty`, `summary -> proTip`, and `shouldWait -> recommendedAction: "WAIT"`.
4. `services/geminiService.ts` — Rewrite `getQuickAdvice(request: QuickAdviceRequest)` (and `streamQuickAdvice`) to call `POST /api/opencode/quick` using `getFirebaseToken()` from `./firebaseService`, consuming the NDJSON heartbeat stream (`ping`, `status`, `result`, `error`), and passing only abstract style cadence fields from `request.userStyle` (never `signaturePatterns` or `rawSamples`).
5. `services/feedbackService.ts` — Map `'real': 'authenticRatings'` and `'playful': 'wittyRatings'` in `calculateFeedbackStats` (`typeMap` at line 127) so feedback on `real` and `playful` tabs aggregates cleanly.

---

## Step-by-Step Implementation Instructions

### Step 1: Create `functions/api/opencode/quick.ts` with Verbatim `QUICK_MODE_SI_V4_1`

Create `functions/api/opencode/quick.ts`. Embed `QUICK_MODE_SI_V4_1` **byte-for-byte** as below:

```ts
export const QUICK_MODE_SI_V4_1 = `You are an elite, socially sharp 21-year-old texting wingman. You craft replies that create real chemistry, wit, intrigue, or genuine connection — the kind of texts someone pauses and smiles at, never safe AI filler, never try-hard slang spam, and never over-eager flirting.

1. READ THE CONVERSATION LIKE A HUMAN:
- Visually inspect any screenshots with care: read the app's sender convention, quoted replies, timestamps, media/snap indicators, and cultural/language context accurately.
- UNSEEN MEDIA RULE: NEVER invent visual details of photos, snaps, or videos that are not actually visible in the screenshot (e.g., if a snap or photo only shows "Opened", "Delivered", or view-once, never compliment outfit colors, lighting, or details you cannot see).
- Identify every unreplied topic from the other person after the user's last text message. Cover ALL active unreplied topics naturally across 1-2 crisp bubbles (max 3 only when genuinely cleaner) in send order. Merge tiny filler messages instead of replying 1-to-1.
- PRIVATE GOAL RULE: If the user writes a Goal/Direction (e.g., wanting to shift gears, be warmer, or escalate), treat it strictly as PRIVATE behind-the-scenes coaching for you. NEVER recite, confess, or echo their internal strategy wording back to the other person. Translate the intention smoothly into natural social behavior.
- React to the VIBE and SUBTEXT, never like an AI mechanically auditing the message. NEVER count someone's emojis out loud (e.g., "five drools", "seven broken hearts") or dissect their phrasing literally — respond to the energy like someone naturally inside the moment.

2. CALIBRATE TO THE RELATIONSHIP STAGE (CRITICAL):
- Match your temperature strictly to the Relationship Stage:
  * stranger / new / talking: You are building spark, intrigue, warmth, and pull — winning them over, NOT already together. Restraint, humor, and effortless charm beat heavy declarations or thirsty compliments. Keep real, smooth, and playful calibrated and attractive without over-showing your hand; reserve overt direct flirting or asking them out primarily for bold.
  * dating: Warm, assured, freer to be overtly affectionate, playful, or direct across tabs.
  * friends: Natural banter and warmth; no forced romantic escalation unless the user's goal calls for it.
  * complicated / ex: Composed, self-respecting, zero chasing; protect the user's leverage.

3. VOICE, CADENCE & SLANG DISCIPLINE:
- Write like a real 21-year-old texting on their phone: lowercase default (ALL CAPS only for rare genuine spikes), no stiff trailing periods, relaxed fragments, natural flow.
- Match the user's actual register from their own visible messages first (clean when they're clean; chaotic/slangy when they're already joking like that).
- Personality lives in the THOUGHT — what you notice, the subtext, the timing, the tease — NEVER in tacking repetitive filler slang ("ngl", "fr", "tbh", "icl", "lowkey", "cooked", "diabolical", "crazy work") onto boring lines. Use modern late-2026 American TikTok/AAVE slang sparingly and ONLY when a phrase genuinely earns its spot. Plain, sharp, blunt English hits hardest.
- Bilingual/Hinglish chats: If the target texts in Hinglish, keep ~80%+ in natural casual English and optionally weave up to ~20% light Hinglish only where effortless — never write full Hindi sentences unless asked. For other languages (Spanish, French, etc.), match their language naturally.
- Emojis: No fixed list. Most lines hit cleaner with zero emojis. Only drop an emoji when it shifts the tone/subtext (dry irony, teasing, deadpan, dramatic reaction, warmth); skip boomer/corny emojis (😂 🤣 😃 🙂 ✨ 💅).
- Casual profanity is fine when the chat's own energy supports it.

4. CRAFT, EDGE & ZERO REPETITION:
- Never write polite customer-service filler or tired internet clichés ("X should be illegal / a war crime", "u deserve a drink/award", "you're your own biggest fan", "come get coffee", "blink twice").
- Punchlines land LAST and stop — never explain the joke or soften a sharp line afterward.
- Organic momentum: avoid flat dead-end statements. Leave an effortless lane for them to text back — a tease they have to defend, a curious angle, a subtle hook, or a genuine question woven naturally into whichever topic bubble fits (not forced onto the last bubble).
- ZERO repetition across the 5 tabs or 3 variations: every variation must take a genuinely distinct angle.

5. THE 5 TABS (DISTINCT TEMPERATURES — DO NOT MAKE ALL 5 SOUND LIKE BOLD):
- real: Grounded, unforced, zero-games human text. Comfortable in your own skin — warm, blunt, or effortlessly curious without trying to impress or overly flirting.
- smooth: Composed, understated charm with a cooler temperature. Subtle wit or quiet confidence that creates pull without handing away all the mystery.
- playful: Dry humor, light teasing, push-pull, or playful friction that makes them smile or defend themselves. Sharp and fun, never corny puns and never thirsty.
- bold: THE tab for direct heat — confident, unambiguous flirtation, unapologetic teasing, or a concrete move. Still smooth and high-value — never needy, corny, or confessional.
- yourStyle: Mirrors the user's real texting texture from their visible messages first, plus their abstract cadence profile second — sounding like THEM on their sharpest day, never a parody and never copying literal catchphrases.

6. THE FRIEND SUMMARY (summary field):
- 2-3 tight, blunt sentences like your sharpest friend looking over your shoulder. Skip obvious recaps; call out the actual subtext, what dynamic is playing out, and what move lands best (or critique their draft straight up if provided). Set shouldWait=true only if replying now genuinely hurts them. Zero therapy-speak.

OUTPUT ONLY RAW VALID JSON (no markdown fences) matching EXACTLY this structure:
{
  "extractedUnrepliedMessages": ["string"],
  "suggestions": {
    "real": [{ "bubbles": [{ "replyTo": "string or null", "text": "string" }] }],
    "smooth": [{ "bubbles": [{ "replyTo": "string or null", "text": "string" }] }],
    "playful": [{ "bubbles": [{ "replyTo": "string or null", "text": "string" }] }],
    "bold": [{ "bubbles": [{ "replyTo": "string or null", "text": "string" }] }],
    "yourStyle": [{ "bubbles": [{ "replyTo": "string or null", "text": "string" }] }]
  },
  "summary": "string",
  "shouldWait": false
}
Provide EXACTLY 3 genuinely distinct variations in each of the 5 tab arrays.`;

interface ImagePart {
  mimeType: string;
  data: string;
}

interface QuickProxyRequest {
  prompt: string;
  images?: ImagePart[];
}

interface ModelSpec {
  id: "muse-spark-1.3-contributor" | "deepseek-v4.1-flash" | "hy4-flash-free";
  format: "responses" | "chat";
  effort: "xhigh" | "high";
  structuredOutput: boolean;
  timeoutMs: number;
}

const QUICK_MODEL_CHAIN: readonly ModelSpec[] = [
  {
    id: "muse-spark-1.3-contributor",
    format: "responses",
    effort: "xhigh",
    structuredOutput: true,
    timeoutMs: 85_000,
  },
  {
    id: "deepseek-v4.1-flash",
    format: "chat",
    effort: "high",
    structuredOutput: true,
    timeoutMs: 70_000,
  },
  {
    id: "hy4-flash-free",
    format: "chat",
    effort: "high",
    structuredOutput: false,
    timeoutMs: 75_000,
  },
];

const REQUIRED_TABS = ["real", "smooth", "playful", "bold", "yourStyle"] as const;
const MAX_IMAGES = 10;
const MAX_PAYLOAD_BYTES = 18 * 1024 * 1024;

function toDataUrl(img: ImagePart): string {
  if (img.data.startsWith("data:")) return img.data;
  const mime = img.mimeType || "image/webp";
  return `data:${mime};base64,${img.data}`;
}

export function cleanAndParseJson(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
    throw new Error("Model output did not contain valid JSON");
  }
}

export function validateQuickV2Payload(parsed: Record<string, unknown>): void {
  const suggestions = parsed.suggestions as Record<string, unknown> | undefined;
  if (!suggestions || typeof suggestions !== "object") {
    throw new Error("Missing suggestions object in model output");
  }
  for (const tab of REQUIRED_TABS) {
    const arr = suggestions[tab];
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`Missing or empty tab '${tab}' in suggestions`);
    }
    const first = arr[0] as Record<string, unknown> | undefined;
    const hasBubbles =
      first &&
      Array.isArray(first.bubbles) &&
      first.bubbles.length > 0 &&
      typeof (first.bubbles[0] as Record<string, unknown>)?.text === "string" &&
      ((first.bubbles[0] as Record<string, unknown>).text as string).trim().length > 0;
    if (!hasBubbles) {
      throw new Error(`Tab '${tab}' first option has no non-empty bubbles`);
    }
  }
  if (typeof parsed.summary !== "string" || parsed.summary.trim().length === 0) {
    throw new Error("Missing non-empty summary field");
  }
}

async function callOpenCodeModel(
  spec: ModelSpec,
  apiKey: string,
  uid: string,
  prompt: string,
  images: ImagePart[]
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), spec.timeoutMs);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Rizzbot/1.0",
    "x-opencode-session": `rizzbot-quick-${uid}-${Date.now()}`,
  };

  try {
    if (spec.format === "responses") {
      const contentParts: Array<Record<string, unknown>> = images.map((img) => ({
        type: "input_image",
        image_url: toDataUrl(img),
      }));
      contentParts.push({ type: "input_text", text: prompt });

      const res = await fetch("https://opencode.ai/inference/go/openai/v1/responses", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: spec.id,
          instructions: QUICK_MODE_SI_V4_1,
          input: [{ role: "user", content: contentParts }],
          reasoning: { effort: spec.effort },
          text: { format: { type: "json_object" } },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`${spec.id} HTTP ${res.status}: ${errBody.slice(0, 240)}`);
      }

      const data = (await res.json()) as {
        output_text?: string;
        output?: Array<{
          type?: string;
          content?: Array<{ type?: string; text?: string }>;
        }>;
      };

      let rawText = typeof data.output_text === "string" ? data.output_text : "";
      if (!rawText && Array.isArray(data.output)) {
        const chunks: string[] = [];
        for (const item of data.output) {
          if (item.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (typeof c.text === "string") chunks.push(c.text);
            }
          }
        }
        rawText = chunks.join("");
      }

      if (!rawText.trim()) {
        throw new Error(`${spec.id} returned empty output_text`);
      }

      const parsed = cleanAndParseJson(rawText);
      validateQuickV2Payload(parsed);
      return parsed;
    } else {
      const userContent: Array<Record<string, unknown>> = images.map((img) => ({
        type: "image_url",
        image_url: { url: toDataUrl(img) },
      }));
      userContent.push({ type: "text", text: prompt });

      const payload: Record<string, unknown> = {
        model: spec.id,
        reasoning_effort: spec.effort,
        messages: [
          { role: "system", content: QUICK_MODE_SI_V4_1 },
          { role: "user", content: userContent },
        ],
      };
      if (spec.structuredOutput) {
        payload.response_format = { type: "json_object" };
      }

      const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`${spec.id} HTTP ${res.status}: ${errBody.slice(0, 240)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawText = data.choices?.[0]?.message?.content ?? "";
      if (!rawText.trim()) {
        throw new Error(`${spec.id} returned empty choices[0].message.content`);
      }

      const parsed = cleanAndParseJson(rawText);
      validateQuickV2Payload(parsed);
      return parsed;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request, data } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = env.OPENCODE_GO_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error: OPENCODE_GO_API_KEY missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large (max 18MB)" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: QuickProxyRequest;
  try {
    body = (await request.json()) as QuickProxyRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return new Response(JSON.stringify({ error: "Missing required field: prompt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  // _middleware.ts attaches context.data.user = { uid, email, ... }
  const uid = (data?.user?.uid as string) || "anon";

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const writeEvent = async (event: Record<string, unknown>) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(event) + "\n"));
    } catch {
      // Client disconnected
    }
  };

  (async () => {
    const heartbeat = setInterval(() => {
      void writeEvent({ type: "ping", ts: Date.now() });
    }, 10_000);

    try {
      const errors: string[] = [];
      for (let i = 0; i < QUICK_MODEL_CHAIN.length; i++) {
        const spec = QUICK_MODEL_CHAIN[i];
        await writeEvent({
          type: "status",
          model: spec.id,
          effort: spec.effort,
          attempt: i + 1,
        });

        try {
          const result = await callOpenCodeModel(spec, apiKey, uid, body.prompt, images);
          await writeEvent({
            type: "result",
            model: spec.id,
            effort: spec.effort,
            data: result,
          });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[opencode/quick] Attempt ${i + 1} (${spec.id}) failed: ${msg}`);
          errors.push(`${spec.id}: ${msg}`);
        }
      }

      await writeEvent({
        type: "error",
        message: "All OpenCode Go models failed to generate a valid response.",
        details: errors,
      });
    } finally {
      clearInterval(heartbeat);
      try {
        await writer.close();
      } catch {
        // Ignore already-closed writer
      }
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
```

---

### Step 2: Update `types.ts` (Add V2 `real`/`playful` Tone Keys, `QuickReplyBubble`, `summary`, `shouldWait`)

In `types.ts`:

1. At lines 132–144 (`MessageReply` & `SuggestionOption`), add `QuickReplyBubble` and optional `bubbles` on `SuggestionOption` while keeping `replies: MessageReply[]` and `conversationHook: string` intact:
   ```ts
   export interface QuickReplyBubble {
     replyTo: string | null;
     text: string;
   }

   /**
    * Individual reply to a specific target message (or single bubble in a sequence).
    */
   export interface MessageReply {
     originalMessage: string; // The target's message this replies to ("" when general bubble)
     reply: string;           // The suggested reply text
   }

   /**
    * A complete suggestion option with replies to all unreplied messages + hook.
    */
   export interface SuggestionOption {
     replies: MessageReply[];      // Replies / bubbles in send order
     conversationHook: string;     // Text to keep the conversation flowing ("" in V2 where hook is woven into bubbles)
     bubbles?: QuickReplyBubble[]; // V2 raw bubble objects
   }
   ```

2. At lines 148–194 (`QuickAdviceResponse`), add `real?: SuggestionOption[]` and `playful?: SuggestionOption[]` to `suggestions`, plus optional V2 `summary?: string`, `shouldWait?: boolean`, and `modelUsed?: string`:
   ```ts
     suggestions: {
       real?: SuggestionOption[];     // V2: grounded, unforced, zero-games human text
       smooth: SuggestionOption[];    // 3 options - natural, effortless
       playful?: SuggestionOption[];  // V2: dry humor, light teasing, push-pull
       bold: SuggestionOption[];      // 3 options - confident, direct, playful tease when warm (Roast merged in)
       witty: SuggestionOption[];     // Legacy V1 alias (populated with playful in V2)
       authentic: SuggestionOption[]; // Legacy V1 alias (populated with real in V2)
       yourStyle: SuggestionOption[]; // 3 options - deep mimicry of user's specific phrasing/quirks
       wait?: string | null;          // Sometimes best move is no move - explains why
     };
     proTip: string; // In V2, populated with `summary` (the 2-3 sentence blunt friend read)
     summary?: string; // V2 2-3 sentence blunt friend read
     shouldWait?: boolean; // V2 wait flag
     modelUsed?: string; // V2 OpenCode Go model ID that fulfilled the request
     recommendedAction: 'SEND' | 'WAIT' | 'CALL' | 'MATCH' | 'PULL_BACK' | 'ABORT';
   ```

3. At line 231 (`FeedbackEntry['suggestionType']`), add `'real' | 'playful'`:
   ```ts
   suggestionType: 'real' | 'smooth' | 'playful' | 'bold' | 'witty' | 'roast' | 'authentic' | 'safe' | 'spicy' | 'you' | 'yourStyle';
   ```

---

### Step 3: Upgrade `services/quickAdvice.ts` & `services/quickAdvice.test.ts`

#### 3A. Replace `services/quickAdvice.ts`

Notice how `ReplyHeroCard.tsx:106-136` and `HistoryScreen.tsx` **already** iterate over `selectedOption.replies: Array<{ originalMessage: string; reply: string }>`!
When `normalizeQuickAdvice(parsed)` converts each V2 option `{ bubbles: [{ replyTo, text }] }` into `{ replies: [{ originalMessage: b.replyTo || "", reply: b.text }], conversationHook: "", bubbles }`, **both** V2 multi-bubble responses and V1 legacy responses work with `ReplyHeroCard.tsx`, `buildCopyPayload(option)`, `HistoryScreen.tsx`, and all 14 existing tests in `services/quickAdvice.test.ts`!

```ts
import { MessageReply, QuickAdviceResponse, QuickReplyBubble, SuggestionOption } from "../types";

export const FALLBACK_PRO_TIP = "ngl couldn't read that one properly, try again";

function normalizeOption(o: any): SuggestionOption | null {
  if (!o || typeof o !== "object") return null;

  // V1 shape: { replies: [{ originalMessage, reply }], conversationHook }
  if (Array.isArray(o.replies) && o.replies.length > 0) {
    return o as SuggestionOption;
  }

  // V2 shape: { bubbles: [{ replyTo: string | null, text: string }] }
  if (Array.isArray(o.bubbles) && o.bubbles.length > 0) {
    const validBubbles: QuickReplyBubble[] = o.bubbles
      .map((b: any): QuickReplyBubble | null => {
        if (!b || typeof b !== "object") return null;
        const text = typeof b.text === "string" ? b.text.trim() : "";
        if (!text) return null;
        const replyTo =
          typeof b.replyTo === "string" && b.replyTo.trim().length > 0
            ? b.replyTo.trim()
            : null;
        return { replyTo, text };
      })
      .filter((b: QuickReplyBubble | null): b is QuickReplyBubble => b !== null)
      .slice(0, 3);

    if (validBubbles.length === 0) return null;

    const replies: MessageReply[] = validBubbles.map((b) => ({
      originalMessage: b.replyTo ?? "",
      reply: b.text,
    }));

    return {
      replies,
      conversationHook: typeof o.conversationHook === "string" ? o.conversationHook : "",
      bubbles: validBubbles,
    };
  }

  return null;
}

/**
 * Normalize a raw model payload (V2 OpenCode Go or legacy V1) into a well-formed QuickAdviceResponse.
 */
export function normalizeQuickAdvice(parsed: any): QuickAdviceResponse {
  const safe = parsed ?? {};
  const normalize = (list: any): SuggestionOption[] =>
    Array.isArray(list)
      ? list.map(normalizeOption).filter((o): o is SuggestionOption => o !== null)
      : [];

  const rawSuggestions = safe.suggestions ?? {};

  const realList = normalize(rawSuggestions.real);
  const authenticList = normalize(rawSuggestions.authentic);
  const playfulList = normalize(rawSuggestions.playful);
  const wittyList = normalize(rawSuggestions.witty);
  const smoothList = normalize(rawSuggestions.smooth);
  const boldPrimary = normalize(rawSuggestions.bold);
  const boldList = boldPrimary.length > 0 ? boldPrimary : normalize(rawSuggestions.roast);
  const yourStyleList = normalize(rawSuggestions.yourStyle);

  // V2 summary field maps to both `summary` and `proTip`
  const v2Summary =
    typeof safe.summary === "string" && safe.summary.trim().length > 0
      ? safe.summary.trim()
      : undefined;
  const proTip =
    (typeof safe.proTip === "string" && safe.proTip.trim().length > 0 ? safe.proTip : undefined) ||
    v2Summary ||
    FALLBACK_PRO_TIP;

  const shouldWait = typeof safe.shouldWait === "boolean" ? safe.shouldWait : false;
  const waitText =
    rawSuggestions.wait !== undefined
      ? rawSuggestions.wait
      : shouldWait
      ? v2Summary || "Give it some breathing room before replying."
      : null;

  const recommendedAction =
    safe.recommendedAction || (shouldWait ? "WAIT" : "MATCH");

  // Build normalized suggestions object. Only include real/playful keys when present in input
  // so legacy V1 unit tests checking exact object equality on bold/roast continue to pass.
  const normalizedSuggestions: QuickAdviceResponse["suggestions"] = {
    smooth: smoothList,
    bold: boldList,
    witty: wittyList.length > 0 ? wittyList : playfulList,
    authentic: authenticList.length > 0 ? authenticList : realList,
    yourStyle: yourStyleList,
    wait: waitText ?? null,
    ...(realList.length > 0 || authenticList.length > 0
      ? { real: realList.length > 0 ? realList : authenticList }
      : {}),
    ...(playfulList.length > 0 || wittyList.length > 0
      ? { playful: playfulList.length > 0 ? playfulList : wittyList }
      : {}),
  };

  return {
    ...safe,
    vibeCheck: safe.vibeCheck || {
      theirEnergy: "neutral",
      interestLevel: 50,
      redFlags: [],
      greenFlags: [],
    },
    suggestions: normalizedSuggestions,
    proTip,
    ...(v2Summary ? { summary: v2Summary } : {}),
    ...(typeof safe.shouldWait === "boolean" ? { shouldWait: safe.shouldWait } : {}),
    recommendedAction,
    degraded: safe?.degraded === true,
  };
}

/**
 * Build the degraded fallback response returned when analysis fails.
 */
export function buildQuickFallback(): QuickAdviceResponse {
  const fallbackOption: SuggestionOption = {
    replies: [{ originalMessage: "their message", reply: "hey" }],
    conversationHook: "whats good",
  };
  return {
    vibeCheck: { theirEnergy: "neutral", interestLevel: 50, redFlags: [], greenFlags: [] },
    suggestions: {
      smooth: [fallbackOption, fallbackOption, fallbackOption],
      bold: [fallbackOption, fallbackOption, fallbackOption],
      witty: [fallbackOption, fallbackOption, fallbackOption],
      authentic: [fallbackOption, fallbackOption, fallbackOption],
      yourStyle: [fallbackOption, fallbackOption, fallbackOption],
      wait: undefined,
    },
    proTip: FALLBACK_PRO_TIP,
    recommendedAction: "MATCH",
    degraded: true,
  };
}

/**
 * Detect whether a quick advice response is the degraded fallback.
 */
export function isQuickAdviceDegraded(r: QuickAdviceResponse): boolean {
  if (r.degraded === true) return true;
  if (r.proTip === FALLBACK_PRO_TIP) return true;
  const first = r.suggestions.smooth?.[0]?.replies?.[0]?.reply;
  return first === "hey";
}

/**
 * Build the copy-all payload: replies joined by blank lines, plus hook.
 */
export function buildCopyPayload(option: SuggestionOption): string {
  const replies = option.replies.map((r) => r.reply).filter(Boolean).join("\n\n");
  const hook = option.conversationHook ? `\n\n${option.conversationHook}` : "";
  return `${replies}${hook}`;
}
```

#### 3B. Add V2 Unit Tests in `services/quickAdvice.test.ts`

Keep lines 1–155 of `services/quickAdvice.test.ts` unchanged (all 14 tests will pass!), and append a new `describe("normalizeQuickAdvice (V2 OpenCode Go schema)", ...)` block testing:
- V2 `bubbles: [{ replyTo: "wyd tonight", text: "chilling, why what's the move" }, { replyTo: null, text: "u trying to cause trouble?" }]` normalizes into `replies: [{ originalMessage: "wyd tonight", reply: "chilling, why what's the move" }, { originalMessage: "", reply: "u trying to cause trouble?" }]` with `conversationHook: ""` and `buildCopyPayload` joining the two bubbles with `\n\n`.
- V2 `real` populates `suggestions.real` and `suggestions.authentic`; V2 `playful` populates `suggestions.playful` and `suggestions.witty`.
- V2 `summary` populates `result.summary` and `result.proTip`, and `isQuickAdviceDegraded(result)` returns `false`.
- V2 `shouldWait: true` sets `result.recommendedAction === "WAIT"` and `result.suggestions.wait === result.summary`.

---

### Step 4: Replace `getQuickAdvice` & `streamQuickAdvice` in `services/geminiService.ts`

In `services/geminiService.ts:585-989`, replace `buildQuickAdviceParts`, `getQuickAdvice`, and `streamQuickAdvice` so Quick Mode calls `POST /api/opencode/quick` using `getFirebaseToken()` from `./firebaseService`:

1. **Abstract Style Formatting (`formatAbstractUserStyle`)**:
   - Reads the real `UserStyleProfile` properties from `types.ts:64-80`:
     `s.capitalization`, `s.punctuation`, `s.emojiUsage`, `s.averageLength`, `s.slangLevel`, `s.preferredTone`, `s.humorStyle`, `s.flirtLevel`, `s.energy`, `s.aiSummary`, and optional `(s as any).cadenceNotes` (from Plan 013).
   - **NEVER** injects `s.signaturePatterns` or `s.rawSamples` into the prompt!
2. **Dynamic Prompt Builder (`buildQuickModeV2Prompt(request: QuickAdviceRequest)`)**:
   - When `request.screenshots && request.screenshots.length > 0`:
     - If `request.theirMessage` is non-empty and not the default `"Analyze the conversation screenshot"` placeholder (`QuickModeScreen.tsx:210`), label it:
       `USER'S PRIVATE GOAL / DIRECTION (BEHIND-THE-SCENES COACHING ONLY — NEVER RECITE OR CONFESS THIS WORDING TO THE OTHER PERSON):\n${request.theirMessage}`
     - Otherwise:
       `USER'S PRIVATE GOAL / DIRECTION: None specified — read the screenshot thread carefully and craft the sharpest replies for every unreplied topic.`
   - When no screenshots are attached:
     - Label `request.theirMessage` as `THEIR MESSAGE / CONVERSATION CONTEXT:\n${request.theirMessage}`.
3. **NDJSON Stream Consumer in `getQuickAdvice(request: QuickAdviceRequest)`**:
   - Extracts `{ mimeType, data }` from `request.screenshots` (up to 10 images).
   - Calls `const token = await getFirebaseToken();` and `fetch('/api/opencode/quick', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: \`Bearer \${token}\` } : {}) }, body: JSON.stringify({ prompt, images }) })`.
   - Reads the NDJSON stream line-by-line, ignoring `{"type":"ping"}` and `{"type":"status"}`, and returns `normalizeQuickAdvice({ ...event.data, modelUsed: event.model })` on `{"type":"result"}`.
   - On network/model failure, returns `buildQuickFallback()` (matching existing error contract in `services/geminiService.ts:918-921`).

```ts
export function formatAbstractUserStyle(s?: UserStyleProfile): string {
  if (!s) {
    return "No saved profile yet — infer the user's natural texting cadence directly from their own messages visible in the screenshots.";
  }
  const lines: string[] = [
    `- Capitalization: ${s.capitalization}`,
    `- Punctuation: ${s.punctuation}`,
    `- Emoji frequency: ${s.emojiUsage}`,
    `- Typical message length: ${s.averageLength}`,
    `- Slang level: ${s.slangLevel}`,
    `- Preferred tone: ${s.preferredTone}`,
  ];
  if (s.humorStyle) lines.push(`- Humor style: ${s.humorStyle}`);
  if (s.flirtLevel) lines.push(`- Flirt calibration: ${s.flirtLevel}`);
  if (s.energy) lines.push(`- Energy level: ${s.energy}`);
  if (s.aiSummary) lines.push(`- Style summary: ${s.aiSummary}`);
  const cadenceNotes = (s as UserStyleProfile & { cadenceNotes?: string }).cadenceNotes;
  if (typeof cadenceNotes === "string" && cadenceNotes.trim().length > 0) {
    lines.push(`- Observed screenshot cadence: ${cadenceNotes.trim()}`);
  }
  return lines.join("\n");
}

export function buildQuickModeV2Prompt(request: QuickAdviceRequest): string {
  const hasScreenshots = Boolean(request.screenshots && request.screenshots.length > 0);
  const rawMsg = (request.theirMessage || "").trim();
  const isDefaultPlaceholder = rawMsg === "Analyze the conversation screenshot";
  const feedbackBias = request.userId ? getPromptBias(request.userId) : "";

  const sections: string[] = [
    `RELATIONSHIP STAGE: ${request.context || "talking"}`,
    `ATTACHED SCREENSHOTS: ${request.screenshots?.length || 0}`,
  ];

  if (hasScreenshots) {
    if (rawMsg && !isDefaultPlaceholder) {
      sections.push(
        `USER'S PRIVATE GOAL / DIRECTION (BEHIND-THE-SCENES COACHING ONLY — NEVER RECITE OR CONFESS THIS WORDING TO THE OTHER PERSON):\n${rawMsg}`
      );
    } else {
      sections.push(
        `USER'S PRIVATE GOAL / DIRECTION: None specified — read the screenshot thread carefully and craft the sharpest replies for every unreplied topic.`
      );
    }
  } else {
    sections.push(`THEIR MESSAGE / CONVERSATION CONTEXT:\n${rawMsg}`);
  }

  if (request.yourDraft && request.yourDraft.trim()) {
    sections.push(
      `USER'S TENTATIVE DRAFT TO CRITIQUE & IMPROVE (critique this honestly in the summary field and outperform it across the 5 tabs):\n"${request.yourDraft.trim()}"`
    );
  }

  sections.push(
    `USER'S ABSTRACT TEXTING CADENCE (use primarily for the yourStyle tab; always prioritize their real messages visible in the screenshot first, and NEVER copy literal catchphrases):\n${formatAbstractUserStyle(request.userStyle)}`
  );

  if (feedbackBias.trim()) {
    sections.push(feedbackBias.trim());
  }

  return sections.join("\n\n");
}
```

---

### Step 5: Update `services/feedbackService.ts:127-137`

In `services/feedbackService.ts`, update `typeMap` inside `calculateFeedbackStats` so `'real'` and `'playful'` feedback entries map cleanly into `authenticRatings` and `wittyRatings`:

```ts
    const typeMap: Record<string, keyof FeedbackStats> = {
      real: 'authenticRatings',
      smooth: 'smoothRatings',
      playful: 'wittyRatings',
      bold: 'boldRatings',
      witty: 'wittyRatings',
      roast: 'boldRatings', // legacy roast entries merge into bold
      authentic: 'authenticRatings',
      safe: 'safeRatings',
      spicy: 'spicyRatings',
      you: 'youRatings',
      yourStyle: 'yourStyleRatings',
    };
```

---

## Test Plan

1. **TypeScript check**:
   ```bash
   npm run typecheck
   ```
   Must exit `0` with zero errors.
2. **Unit tests**:
   ```bash
   npm test
   ```
   Must pass all 14 existing tests in `services/quickAdvice.test.ts` + all 12 tests in `services/feedbackService.test.ts` + the new V2 multi-bubble normalization tests.
3. **Production build**:
   ```bash
   npm run build
   ```
   Must succeed with zero errors.

---

## Done Criteria

- [ ] `functions/api/opencode/quick.ts` exists, embeds `QUICK_MODE_SI_V4_1` verbatim, reads `context.data?.user?.uid`, enforces the 3-model fallback chain (`muse-spark-1.3-contributor:xhigh` → `deepseek-v4.1-flash:high` → `hy4-flash-free:high`), and streams NDJSON with a 10s heartbeat.
- [ ] `types.ts` adds `QuickReplyBubble`, optional `bubbles?: QuickReplyBubble[]` on `SuggestionOption`, `real?: SuggestionOption[]` and `playful?: SuggestionOption[]` on `QuickAdviceResponse['suggestions']`, and `'real' | 'playful'` on `FeedbackEntry['suggestionType']`.
- [ ] `services/quickAdvice.ts` (`normalizeQuickAdvice`) normalizes both V2 (`bubbles`, `real`, `playful`, `summary`, `shouldWait`) and V1 (`replies`, `smooth`, `bold`, `roast`, `witty`, `authentic`, `yourStyle`) payloads.
- [ ] `getQuickAdvice(request: QuickAdviceRequest)` in `services/geminiService.ts` calls `POST /api/opencode/quick` using `getFirebaseToken()` from `./firebaseService` and formats abstract user style without `signaturePatterns`.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` all exit 0.

---

## STOP Conditions

- **STOP** if you hardcode any API key (`oc_sk_...`) in source code, tests, or `wrangler.toml`. Always read `env.OPENCODE_GO_API_KEY`.
- **STOP** if any of the 14 existing unit tests in `services/quickAdvice.test.ts` fail.
