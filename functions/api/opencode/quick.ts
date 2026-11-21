
import { toDataUrl as buildDataUrl, cleanJsonObject } from "../../lib/json";
import { corsHeadersFor } from "../../lib/cors";
import { telemetry } from "../../lib/telemetry";

export const QUICK_SI_VERSION = "v4.2";

export const QUICK_MODE_SI_V4_1 = `You are an elite, socially sharp 21-year-old texting wingman. You craft replies that create real chemistry, wit, intrigue, or genuine connection — the kind of texts someone pauses and smiles at, never safe AI filler, never try-hard slang spam, and never over-eager flirting.

1. READ THE CONVERSATION LIKE A HUMAN:
- Visually inspect any screenshots with care: read the app's sender convention, quoted replies, media/snap indicators, timestamps, and cultural/language context accurately.
- UNSEEN MEDIA RULE: NEVER invent visual details of photos, snaps, or videos that are not actually visible in the screenshot (e.g., if a snap or photo only shows "Opened", "Delivered", or view-once, never compliment outfit colors, lighting, or details you cannot see).
- Identify every unreplied topic from the other person after the user's last text message. Reply to ALL of them — use as many bubbles as there are topics (if they sent 11 texts, you send ~11 bubbles), one thought per bubble, in send order. Match their texting volume so the exchange feels natural, never cram multiple topics into one bubble just to keep the count low. Only merge true filler (a lone "lol" or emoji reaction with no content) into a neighboring bubble.
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

interface Env {
  OPENCODE_GO_API_KEY: string;
}

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
  return buildDataUrl(img.mimeType, img.data);
}

export function cleanAndParseJson(rawText: string): Record<string, unknown> {
  return cleanJsonObject(rawText);
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
    const hasLegacyText =
      first && typeof first.text === "string" && (first.text as string).trim().length > 0;
    if (!hasBubbles && !hasLegacyText) {
      throw new Error(`Tab '${tab}' first option has no non-empty bubbles or text`);
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

export async function onRequest(context: any) {
  const { env, request, data } = context;

  const corsHeaders = corsHeadersFor(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed, use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = (env as Env).OPENCODE_GO_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error: OPENCODE_GO_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
  const uid =
    (data?.user?.uid as string | undefined) ||
    (data?.uid as string | undefined) ||
    "anon";

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

    // Strict sequential fallback: spark xhigh runs alone with its full
    // timeout. Deepseek/hy4 fire ONLY if spark errors or returns invalid
    // output — never in parallel, never racing quality away from spark.
    try {
      const errors: string[] = [];
      const db = (env as any).RIZZBOT_DATA;

      for (let i = 0; i < QUICK_MODEL_CHAIN.length; i++) {
        const spec = QUICK_MODEL_CHAIN[i];
        await writeEvent({
          type: "status",
          model: spec.id,
          effort: spec.effort,
          attempt: i + 1,
        });

        const t0 = Date.now();
        try {
          const result = await callOpenCodeModel(spec, apiKey, uid, body.prompt, images);
          telemetry(context, db, {
            endpoint: "opencode/quick",
            model: spec.id,
            latencyMs: Date.now() - t0,
            ok: true,
            uid,
          });
          await writeEvent({
            type: "result",
            model: spec.id,
            effort: spec.effort,
            siVersion: QUICK_SI_VERSION,
            data: result,
          });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[opencode/quick] Attempt ${i + 1} (${spec.id}) failed: ${msg}`);
          errors.push(`${spec.id}: ${msg}`);
          telemetry(context, db, {
            endpoint: "opencode/quick",
            model: spec.id,
            latencyMs: Date.now() - t0,
            ok: false,
            error: msg.slice(0, 300),
            uid,
          });
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
      "X-SI-Version": QUICK_SI_VERSION,
    },
  });
}

export const onRequestPost = onRequest;


