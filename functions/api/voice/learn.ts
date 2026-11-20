import { ensureAppSchema } from "../schema";

const MAX_LEARNED_SAMPLES = 40;

const VOICE_EXTRACTION_INSTRUCTION = `You analyze chat screenshots to learn how the USER (the person who took the screenshot) texts.

1. IDENTIFY THE USER'S OWN MESSAGES ONLY:
- In iMessage, Instagram, WhatsApp, Hinge, Tinder, Telegram: the user's messages are the RIGHT-SIDE bubbles.
- In Snapchat: the user's messages are labeled "Me" (usually red/pink or blue vertical bar with "Me").
- NEVER extract messages sent by the other person. If no user messages are visible, return an empty array for userMessages.
- Skip pure media/status rows with no text (e.g. "Opened", "Delivered", "Seen").

2. SYNTHESIZE ABSTRACT CADENCE (NO CATCHPHRASE COPYING):
- Given the user's visible messages (and any previously learned samples provided in the prompt), infer their structural texting habits:
  * emoji_usage: "none" | "minimal" | "moderate" | "heavy"
  * capitalization: "lowercase" | "normal" | "mixed"
  * punctuation: "none" | "minimal" | "full"
  * averageLength: "short" | "medium" | "long"
  * energy: "low" | "medium" | "high"
  * preferredTone: "playful" | "chill" | "direct" | "sweet"
  * cadenceNotes: 1-2 sentences describing HOW they structure thoughts, sentence length, fragments, capitalization, and humor rhythm, using ONLY everyday descriptive words.
- ANTI-PARROT RULES for cadenceNotes:
  * NEVER quote the user's words back longer than 2 words in a row.
  * NEVER name specific catchphrases, slang, or jokes as things to repeat — describe the rhythm, not the content.
  * You MAY end cadenceNotes with up to 4 single signature words, but ONLY words that appear 3 or more times across all samples (e.g. "leans on 'wait' and 'nah' as dry pivots"). If no word repeats that often, say nothing about specific words.
  * Ignore content (names, places, plans, stories) — learn the lingo shape and the major texting tells, not the message.

OUTPUT ONLY RAW VALID JSON matching:
{
  "userMessages": ["string"],
  "emoji_usage": "minimal",
  "capitalization": "lowercase",
  "punctuation": "minimal",
  "averageLength": "short",
  "energy": "low",
  "preferredTone": "chill",
  "cadenceNotes": "string"
}`;

function toDataUrl(mimeType: string, data: string): string {
  if (data.startsWith("data:")) return data;
  return `data:${mimeType || "image/webp"};base64,${data}`;
}

function cleanJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a !== -1 && b > a) return JSON.parse(stripped.slice(a, b + 1));
    throw new Error("Invalid JSON from voice model");
  }
}

async function callVoiceModel(
  apiKey: string,
  uid: string,
  images: Array<{ mimeType: string; data: string }>,
  priorSamples: string[]
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Rizzbot/1.0",
    "x-opencode-session": `rizzbot-voice-learn-${uid}-${Date.now()}`,
  };

  const userContent: Array<Record<string, unknown>> = images.map((img) => ({
    type: "image_url",
    image_url: { url: toDataUrl(img.mimeType, img.data) },
  }));
  userContent.push({
    type: "text",
    text: `${VOICE_EXTRACTION_INSTRUCTION}\n\nPRIOR SAMPLES (dedupe against these):\n${priorSamples.slice(-20).join("\n")}`,
  });

  // Primary: muse-spark-1.3-contributor low via responses API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch("https://opencode.ai/inference/go/openai/v1/responses", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: "muse-spark-1.3-contributor",
          instructions: VOICE_EXTRACTION_INSTRUCTION,
          input: [{ role: "user", content: [...images.map((img) => ({ type: "input_image", image_url: toDataUrl(img.mimeType, img.data) })), { type: "input_text", text: `PRIOR SAMPLES:\n${priorSamples.slice(-20).join("\n")}` }] }],
          reasoning: { effort: "low" },
          text: { format: { type: "json_object" } },
        }),
      });
      if (!res.ok) throw new Error(`muse-spark HTTP ${res.status}`);
      const data = (await res.json()) as any;
      let raw = data.output_text as string || "";
      if (!raw && Array.isArray(data.output)) {
        raw = data.output.flatMap((o: any) => (o.type === "message" ? (o.content || []).map((c: any) => c.text || "") : [])).join("");
      }
      if (raw.trim()) return cleanJson(raw);
      throw new Error("empty primary");
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.warn("[voice/learn] primary failed, trying fallback:", (e as Error).message);
  }

  const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "hy4-flash-free",
      reasoning_effort: "high",
      messages: [
        { role: "system", content: VOICE_EXTRACTION_INSTRUCTION },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) throw new Error(`fallback HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) throw new Error("empty fallback");
  return cleanJson(raw);
}

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const uid = data?.user?.uid as string | undefined;
  if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const apiKey = (env as any).OPENCODE_GO_API_KEY as string | undefined;
  if (!apiKey) return new Response(JSON.stringify({ error: "OPENCODE_GO_API_KEY missing" }), { status: 500, headers: corsHeaders });

  const db = (env as any).RIZZBOT_DATA;
  if (!db) return new Response(JSON.stringify({ error: "D1 binding not found" }), { status: 500, headers: corsHeaders });

  let body: { images?: Array<{ mimeType: string; data: string }> };
  try {
    body = (await request.json()) as any;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }
  const images = Array.isArray(body.images) ? body.images.slice(0, 10) : [];
  if (images.length === 0) {
    return new Response(JSON.stringify({ updated: false, extractedMessages: [] }), { status: 200, headers: corsHeaders });
  }

  try {
    await ensureAppSchema(db);
    const userRow = (await db.prepare("SELECT id FROM users WHERE anon_id = ?").bind(uid).first()) as any;
    let dbUserId = userRow?.id;
    if (!dbUserId) {
      await db.prepare("INSERT OR IGNORE INTO users (anon_id) VALUES (?)").bind(uid).run();
      const row = (await db.prepare("SELECT id FROM users WHERE anon_id = ?").bind(uid).first()) as any;
      dbUserId = row?.id;
    }
    const existing = (await db.prepare("SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(dbUserId).first()) as any;

    let priorSamples: string[] = [];
    try {
      const raw = existing?.learned_samples;
      priorSamples = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    } catch {
      priorSamples = [];
    }

    const parsed = await callVoiceModel(apiKey, uid, images, priorSamples);
    const extracted: string[] = Array.isArray(parsed.userMessages)
      ? parsed.userMessages
          .filter((m: any) => typeof m === "string" && m.trim().length >= 4)
          .map((m: string) => m.trim().slice(0, 120))
          .filter((m: string) => m.length >= 4)
          .slice(0, 20)
      : [];

    // Dedupe (case-insensitive) + rolling 40
    const seen = new Set(priorSamples.map((s) => s.toLowerCase()));
    const fresh: string[] = [];
    for (const m of extracted) {
      const k = m.toLowerCase();
      if (k === "ok" || k === "lol" || seen.has(k)) continue;
      seen.add(k);
      fresh.push(m);
    }
    const merged = [...priorSamples, ...fresh].slice(-MAX_LEARNED_SAMPLES);

    const shouldUpdateProfile = fresh.length >= 2 || (!existing?.cadence_notes && merged.length >= 3);
    const profile = {
      emoji_usage: parsed.emoji_usage || existing?.emoji_usage || "minimal",
      capitalization: parsed.capitalization || existing?.capitalization || "lowercase",
      punctuation: parsed.punctuation || existing?.punctuation || "minimal",
      average_length: parsed.averageLength || existing?.average_length || "short",
      slang_level: existing?.slang_level || "casual",
      signature_patterns: existing?.signature_patterns || "[]",
      preferred_tone: parsed.preferredTone || existing?.preferred_tone || "chill",
      raw_samples: existing?.raw_samples || null,
      ai_summary: existing?.ai_summary || null,
      favorite_emojis: existing?.favorite_emojis || null,
      response_speed: existing?.response_speed || "normal",
      flirt_level: existing?.flirt_level || "subtle",
      humor_style: existing?.humor_style || "playful",
      energy: parsed.energy || existing?.energy || "medium",
      learned_samples: JSON.stringify(merged),
      cadence_notes: typeof parsed.cadenceNotes === "string" && parsed.cadenceNotes.trim() ? parsed.cadenceNotes.trim() : (existing?.cadence_notes || ""),
      sample_count: merged.length,
    };

    if (shouldUpdateProfile || fresh.length > 0) {
      await db.prepare(
        `INSERT INTO style_profiles (user_id, emoji_usage, capitalization, punctuation, average_length, slang_level, signature_patterns, preferred_tone, raw_samples, ai_summary, favorite_emojis, response_speed, flirt_level, humor_style, energy, learned_samples, cadence_notes, sample_count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        dbUserId,
        profile.emoji_usage, profile.capitalization, profile.punctuation, profile.average_length,
        profile.slang_level, profile.signature_patterns, profile.preferred_tone, profile.raw_samples,
        profile.ai_summary, profile.favorite_emojis, profile.response_speed, profile.flirt_level,
        profile.humor_style, profile.energy, profile.learned_samples, profile.cadence_notes, profile.sample_count
      ).run();
    }

    return new Response(JSON.stringify({
      updated: fresh.length > 0,
      newMessages: fresh.length,
      extractedMessages: fresh,
      profile: {
        emojiUsage: profile.emoji_usage,
        capitalization: profile.capitalization,
        punctuation: profile.punctuation,
        averageLength: profile.average_length,
        slangLevel: profile.slang_level,
        signaturePatterns: [],
        preferredTone: profile.preferred_tone,
        energy: profile.energy,
        responseSpeed: profile.response_speed,
        flirtLevel: profile.flirt_level,
        humorStyle: profile.humor_style,
        aiSummary: profile.ai_summary,
        rawSamples: [],
        learnedSamples: merged,
        cadenceNotes: profile.cadence_notes,
        sampleCount: merged.length,
      },
    }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[voice/learn] error:", err?.message);
    return new Response(JSON.stringify({ updated: false, error: err?.message || "learn failed" }), { status: 200, headers: corsHeaders });
  }
}
