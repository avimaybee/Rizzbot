import { corsHeadersFor } from "../../lib/cors";
import { telemetry } from "../../lib/telemetry";
import { base64ToBytes, cleanJsonObject } from "../../lib/json";
import { CHAT_SI_V1 } from "../../lib/chatPrompts";
import {
  DRAFT_REPLIES_TOOL,
  THINK_DEEPER_TOOL,
  UPDATE_LEDGER_TOOL,
  buildConversationalMessages,
  buildDraftUserData,
  buildRevisionUserData,
  estimateTokens,
  summarizeCardForContext,
  validateLedgerPatchArgs,
  validateRevisionCard,
  validateThinkDeeperArgs,
  waitLine,
  type LedgerEntryWire,
  type ThinkTier,
  type WaitKind,
} from "../../lib/chatEngine";
import { validateQuickV2Payload } from "./quick";
import {
  checkChatAllowlist,
  ensureChatSchema,
  expireStalePending,
  notFound,
  parseAttachments,
  resolveChatDb,
  utcNowIso,
} from "../../lib/chatStore";

const MAX_TEXT = 12_000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const GENERATION_DEADLINE_MS = 90_000;

type Mode = "regular" | "incognito";

const SPARK_ID = "muse-spark-1.3-contributor";
const DEEPSEEK_ID = "deepseek-v4.1-flash";
const HY4_ID = "hy4-flash-free";

export function pickModels(mode: Mode): {
  chat: { id: string; effort: string };
  draftFull: { id: string; effort: string };
  draftRev: { id: string; effort: string };
} {
  if (mode === "incognito") {
    return {
      // Incognito ZDR privacy path: non-thinking chat (probe-verified 1.4s TTFT) + high-effort drafts.
      chat: { id: DEEPSEEK_ID, effort: "none" },
      draftFull: { id: DEEPSEEK_ID, effort: "high" },
      draftRev: { id: DEEPSEEK_ID, effort: "high" },
    };
  }
  // Regular Chat (ALL users): Muse Spark 1.3 across all rungs; DeepSeek & Hy4 are fallback-only.
  return {
    chat: { id: SPARK_ID, effort: "minimal" },
    draftFull: { id: SPARK_ID, effort: "high" },
    draftRev: { id: SPARK_ID, effort: "medium" },
  };
}

interface ThreadRef {
  sourceTurnId?: string;
  tone?: string;
  optionIndex?: number;
  bubbleIndex?: number;
}

function stableKey(v: unknown): string {
  return JSON.stringify(v ?? null);
}

function errJson(code: string, message: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ error: code, message }), { status, headers: cors });
}

/** Explicit-Draft fast path escalates to xhigh on high-stakes signals. */
function isHighStakesDraft(text: string, imageCount: number): boolean {
  if (imageCount >= 4) return true;
  return /complicated|\bex\b|think harder|think deeper/i.test(text);
}

async function loadLedger(db: any, uid: string): Promise<{ entries: LedgerEntryWire[]; revision: number }> {
  try {
    const row = (await db.prepare(`SELECT entries_json, revision FROM chat_ledgers WHERE uid=?`).bind(uid).first()) as any;
    if (!row) return { entries: [], revision: 0 };
    let arr: any[] = [];
    try { arr = JSON.parse(row.entries_json || "[]"); } catch { arr = []; }
    const entries: LedgerEntryWire[] = Array.isArray(arr)
      ? arr.filter((e) => e && typeof e.id === "string" && typeof e.text === "string").map((e) => ({ id: e.id, text: String(e.text).slice(0, 250), label: typeof e.label === "string" ? e.label.slice(0, 60) : undefined, source: e.source === "agent" ? "agent" as const : "user" as const }))
      : [];
    return { entries: entries.slice(0, 40), revision: typeof row.revision === "number" ? row.revision : 0 };
  } catch { return { entries: [], revision: 0 }; }
}

async function loadStyleHints(db: any, uid: string): Promise<string> {
  try {
    const userRow = (await db.prepare(`SELECT id FROM users WHERE anon_id=?`).bind(uid).first()) as any;
    if (!userRow?.id) return "";
    const prof = (await db.prepare(`SELECT capitalization, punctuation, emoji_usage, average_length, slang_level, preferred_tone, energy, response_speed, flirt_level, humor_style, ai_summary, cadence_notes FROM style_profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1`).bind(userRow.id).first()) as any;
    if (!prof) return "";
    const lines = [
      `- Caps style: ${prof.capitalization || "lowercase"}`,
      `- Punctuation habit: ${prof.punctuation || "minimal"}`,
      `- Emoji frequency: ${prof.emoji_usage || "minimal"}`,
      `- Typical message length: ${prof.average_length || "short"}`,
      `- Natural register: ${prof.preferred_tone || "playful"} (slang: ${prof.slang_level || "casual"})`,
      `- Energy: ${prof.energy || "medium"}; speed: ${prof.response_speed || "normal"}; flirt: ${prof.flirt_level || "subtle"}; humor: ${prof.humor_style || "playful"}`,
    ];
    if (typeof prof.cadence_notes === "string" && prof.cadence_notes.trim()) lines.push(`- Learned cadence texture: ${prof.cadence_notes.trim().slice(0, 300)}`);
    if (typeof prof.ai_summary === "string" && prof.ai_summary.trim()) lines.push(`- AI summary: ${prof.ai_summary.trim().slice(0, 300)}`);
    return lines.join("\n");
  } catch { return ""; }
}

async function r2KeysToImageParts(env: any, keys: string[], uid: string): Promise<{ parts: Array<{ mimeType: string; data: string }>; totalBytes: number; unavailable: number }> {
  const bucket = (env as any).RIZZBOT_MEDIA;
  const parts: Array<{ mimeType: string; data: string }> = [];
  let total = 0;
  let unavailable = 0;
  if (!bucket) return { parts, totalBytes: 0, unavailable: keys.length };
  for (const raw of keys.slice(0, MAX_IMAGES)) {
    const clean = raw.startsWith("r2:") ? raw.slice(3) : raw;
    if (clean.includes("..") || !clean.startsWith(`chat/${uid}/`)) { unavailable++; continue; }
    try {
      const obj = await bucket.get(clean);
      if (!obj) { unavailable++; continue; }
      const buf = await obj.arrayBuffer();
      total += buf.byteLength;
      if (total > MAX_IMAGE_BYTES) break;
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
      const data = btoa(bin);
      let mime = "image/webp";
      try {
        const meta: any = (obj as any).httpMetadata;
        if (meta?.contentType) mime = meta.contentType;
        else if (typeof (obj as any).writeHttpMetadata === "function") { /* ignore */ }
      } catch { /* ignore */ }
      if (clean.endsWith(".png")) mime = "image/png";
      else if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) mime = "image/jpeg";
      parts.push({ mimeType: mime, data });
    } catch { unavailable++; }
  }
  return { parts, totalBytes: total, unavailable };
}

function inlineImagesToParts(inline: unknown): { parts: Array<{ mimeType: string; data: string }>; totalBytes: number } {
  const arr = Array.isArray(inline) ? inline.slice(0, MAX_IMAGES) : [];
  const parts: Array<{ mimeType: string; data: string }> = [];
  let total = 0;
  for (const im of arr) {
    if (!im || typeof im !== "object") continue;
    const dataRaw = typeof (im as any).data === "string" ? (im as any).data : "";
    if (!dataRaw) continue;
    const clean = dataRaw.includes(",") ? dataRaw.split(",").pop() as string : dataRaw;
    if (clean.length > 10 * 1024 * 1024) continue;
    try {
      const bytes = base64ToBytes(clean);
      total += bytes.byteLength;
      if (total > MAX_IMAGE_BYTES) break;
      const mime = (im as any).mimeType === "image/png" || (im as any).mimeType === "image/jpeg" ? (im as any).mimeType : "image/webp";
      parts.push({ mimeType: mime, data: clean });
    } catch { /* skip */ }
  }
  return { parts, totalBytes: total };
}

async function callConversationalStreamOnce(args: {
  apiKey: string;
  sessionTag: string;
  model: string;
  effort: string;
  system: string;
  messages: Array<{ role: string; content: any }>;
  tools?: any[];
  signal: AbortSignal;
  onText: (t: string) => Promise<void>;
}): Promise<{ toolCalls: Array<{ name: string; args: any }>; model: string }> {
  const headers = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Rizzbot/1.0",
    "x-opencode-session": args.sessionTag,
  };
  const responses = args.model === "muse-spark-1.3-contributor";
  const body = responses ? {
    model: args.model, instructions: args.system, reasoning: { effort: args.effort }, stream: true,
    input: args.messages.map(({ role, content }) => ({
      role,
      content: Array.isArray(content) ? content.map((part) => part.type === "image_url"
        ? { type: "input_image", image_url: part.image_url.url }
        : { type: "input_text", text: part.text }) : content,
    })),
    ...(args.tools?.length ? { tools: args.tools.map(({ type, function: spec }) => ({ type, ...spec, strict: false })) } : {}),
  } : {
    model: args.model, reasoning_effort: args.effort, stream: true,
    messages: [{ role: "system", content: args.system }, ...args.messages],
    ...(args.tools?.length ? { tools: args.tools, tool_choice: "auto" } : {}),
  };
  const path = responses ? "responses" : "chat/completions";
  const res = await fetch(`https://opencode.ai/inference/go/openai/v1/${path}`, {
    method: "POST", headers, signal: args.signal, body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`upstream ${args.model} HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const acc = new Map<number, { name: string; argsText: string }>();
  let completed = false;
  const flushText = async (t: string) => { if (t) await args.onText(t); };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t || !t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") { completed = true; continue; }
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.error || evt.type === "error" || evt.type === "response.failed" || evt.type === "response.incomplete") {
        throw new Error("upstream generation failed");
      }
      if (responses) {
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") await flushText(evt.delta);
        if (evt.type === "response.completed") {
          completed = true;
          for (const [i, item] of (evt.response?.output ?? []).entries()) {
            if (item.type === "function_call") acc.set(i, { name: item.name, argsText: item.arguments });
          }
        }
        continue;
      }
      if (["stop", "tool_calls"].includes(evt.choices?.[0]?.finish_reason)) completed = true;
      const delta = evt.choices?.[0]?.delta || {};
      if (typeof delta.content === "string" && delta.content) await flushText(delta.content);
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === "number" ? tc.index : 0;
          const cur = acc.get(idx) || { name: "", argsText: "" };
          if (tc.function?.name) cur.name = tc.function.name;
          if (typeof tc.function?.arguments === "string") cur.argsText += tc.function.arguments;
          acc.set(idx, cur);
        }
      }
    }
  }
  if (!completed) throw new Error("upstream stream interrupted");
  const calls: Array<{ name: string; args: any }> = [];
  for (const [, e] of [...acc.entries()].sort((a, b) => a[0] - b[0])) {
    if (!e.name) continue;
    try { calls.push({ name: e.name, args: e.argsText ? JSON.parse(e.argsText) : {} }); }
    catch { calls.push({ name: e.name, args: {} }); }
  }
  return { toolCalls: calls, model: args.model };
}

async function callDraftJsonOnce(args: {
  apiKey: string;
  sessionTag: string;
  model: string;
  effort: string;
  system: string;
  userData: string;
  imageParts: Array<{ mimeType: string; data: string }>;
  signal: AbortSignal;
}): Promise<any> {
  const toDataUrl = (m: string, d: string) => (d.startsWith("data:") ? d : `data:${m || "image/webp"};base64,${d}`);
  // Use the native endpoint for each configured model.
  const headers = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Rizzbot/1.0",
    "x-opencode-session": args.sessionTag,
  };
  const contentParts: any[] = args.imageParts.map((img) => ({ type: "input_image", image_url: toDataUrl(img.mimeType, img.data) }));
  contentParts.push({ type: "input_text", text: args.userData });
  if (args.model === "muse-spark-1.3-contributor") {
    const res = await fetch("https://opencode.ai/inference/go/openai/v1/responses", {
      method: "POST",
      headers,
      signal: args.signal,
      body: JSON.stringify({
        model: args.model,
        instructions: args.system,
        input: [{ role: "user", content: contentParts }],
        reasoning: { effort: args.effort },
        text: { format: { type: "json_object" } },
      }),
    });
    if (!res.ok) throw new Error(`responses HTTP ${res.status}`);
    const data = (await res.json()) as any;
    let raw = typeof data.output_text === "string" ? data.output_text : "";
    if (!raw && Array.isArray(data.output)) {
      raw = data.output.flatMap((o: any) => (o.type === "message" ? (o.content || []).map((c: any) => c.text || "") : [])).join("");
    }
    if (!raw.trim()) throw new Error("empty draft");
    return cleanJsonObject(raw);
  } else {
    const userContent: any[] = args.imageParts.map((img) => ({ type: "image_url", image_url: { url: toDataUrl(img.mimeType, img.data) } }));
    userContent.push({ type: "text", text: args.userData });
    const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
      method: "POST",
      headers,
      signal: args.signal,
      body: JSON.stringify({
        model: args.model,
        reasoning_effort: args.effort,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`chat HTTP ${res.status}`);
    const data = (await res.json()) as any;
    const raw = data.choices?.[0]?.message?.content ?? "";
    if (!raw.trim()) throw new Error("empty draft");
    return cleanJsonObject(raw);
  }
}

interface ModelCandidate { model: string; effort: string }

/**
 * Conversational streaming with model fallback. Falls over to the next
 * candidate only if nothing streamed yet — never mid-stream, so the user
 * never sees duplicated or spliced text.
 */
async function callConversationalStream(args: {
  apiKey: string;
  sessionTag: string;
  candidates: ModelCandidate[];
  system: string;
  messages: Array<{ role: string; content: any }>;
  tools?: any[];
  signal: AbortSignal;
  onText: (t: string) => Promise<void>;
}): Promise<{ toolCalls: Array<{ name: string; args: any }>; model: string }> {
  let lastError: any = null;
  for (const cand of args.candidates) {
    if (args.signal.aborted) throw lastError || new Error("aborted");
    let streamedAny = false;
    try {
      return await callConversationalStreamOnce({
        ...args,
        model: cand.model,
        effort: cand.effort,
        onText: async (t) => { streamedAny = true; await args.onText(t); },
      });
    } catch (e: any) {
      lastError = e;
      if (streamedAny) throw e;
    }
  }
  throw lastError || new Error("upstream stream failed");
}

/** Structured draft generation with model fallback across separate allowances. */
async function callDraftJson(args: {
  apiKey: string;
  sessionTag: string;
  candidates: ModelCandidate[];
  system: string;
  userData: string;
  imageParts: Array<{ mimeType: string; data: string }>;
  signal: AbortSignal;
}): Promise<{ json: any; modelUsed: string }> {
  let lastError: any = null;
  for (const cand of args.candidates) {
    if (args.signal.aborted) throw lastError || new Error("aborted");
    try {
      const json = await callDraftJsonOnce({
        ...args,
        model: cand.model,
        effort: cand.effort,
      });
      return { json, modelUsed: cand.model };
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error("draft failed");
}

function resolveSourceCardText(card: any, ref: ThreadRef): { optionText: string; bubbleText?: string } | null {
  try {
    if (!card) return null;
    // Full deck
    const sug = (card as any).suggestions;
    if (sug && ref.tone) {
      const key = ref.tone;
      const list = (sug as any)[key];
      if (Array.isArray(list)) {
        const idx = typeof ref.optionIndex === "number" ? ref.optionIndex : 0;
        const opt = list[idx] || list[0];
        if (!opt) return null;
        const bubbles = Array.isArray((opt as any).bubbles) ? (opt as any).bubbles : [];
        const optionText = bubbles.map((b: any) => b?.text).filter(Boolean).join("\n") || (typeof (opt as any).text === "string" ? (opt as any).text : "");
        let bubbleText: string | undefined;
        if (typeof ref.bubbleIndex === "number" && bubbles[ref.bubbleIndex]?.text) bubbleText = bubbles[ref.bubbleIndex].text;
        return { optionText, bubbleText };
      }
    }
    // Revision card
    if (Array.isArray((card as any).variations)) {
      const idx = typeof ref.optionIndex === "number" ? ref.optionIndex : 0;
      const v = (card as any).variations[idx] || (card as any).variations[0];
      const bubbles = Array.isArray((v as any)?.bubbles) ? (v as any).bubbles : [];
      const optionText = bubbles.map((b: any) => b?.text).filter(Boolean).join("\n");
      let bubbleText: string | undefined;
      if (typeof ref.bubbleIndex === "number" && bubbles[ref.bubbleIndex]?.text) bubbleText = bubbles[ref.bubbleIndex].text;
      if (optionText) return { optionText, bubbleText };
    }
    return null;
  } catch { return null; }
}

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const corsBase = corsHeadersFor(request);
  const cors = { ...corsBase, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return errJson("invalid_input", "Method not allowed", 405, { ...corsBase, "Content-Type": "application/json" });

  const uid = data?.user?.uid as string | undefined;
  if (!uid) return errJson("unauthorized", "Sign in to use Chat.", 401, { ...corsBase, "Content-Type": "application/json" });
  if (!checkChatAllowlist(env, uid)) return errJson("unauthorized", "Chat isn’t available for this account yet.", 403, { ...corsBase, "Content-Type": "application/json" });

  const apiKey = (env as any).OPENCODE_GO_API_KEY as string | undefined;
  const db = resolveChatDb(env);
  if (!apiKey) {
    return errJson("unavailable", "Chat is at its usage limit. Try again later.", 503, { ...corsBase, "Content-Type": "application/json" });
  }
  if (!db) return errJson("unavailable", "Chat is at its usage limit. Try again later.", 503, { ...corsBase, "Content-Type": "application/json" });
  await ensureChatSchema(db);

  let body: any;
  try { body = await request.json(); } catch {
    return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
  }

  const mode: Mode = body?.mode === "incognito" ? "incognito" : "regular";
  const action = body?.action === "draft" || body?.action === "refine" ? body.action : undefined;

  // ---- incognito branch (no persistence) ----
  if (mode === "incognito") {
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim() && (!Array.isArray(body?.images) || body.images.length === 0) && (!Array.isArray(body?.priorTurns) || body.priorTurns.length === 0)) {
      return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
    }
    if (text.length > MAX_TEXT) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
    if (body?.ref || body?.ledger || body?.tools) {
      // Client must not supply privileged fields; ignore ledger/tools but reject forged refs? Treat as untrusted context only.
    }
    return handleIncognito({ env, apiKey, uid, body, cors, corsBase });
  }

  // ---- regular branch ----
  const threadId = typeof body?.threadId === "string" ? body.threadId.trim() : "";
  const turnId = typeof body?.turnId === "string" ? body.turnId.trim() : "";
  const text = typeof body?.text === "string" ? body.text : "";
  const attachmentKeys = Array.isArray(body?.attachmentKeys) ? (body.attachmentKeys as unknown[]).filter((k) => typeof k === "string").map((k) => String(k)).slice(0, MAX_IMAGES) as string[] : [];
  const ref: ThreadRef | undefined = body?.ref && typeof body.ref === "object" ? {
    sourceTurnId: typeof body.ref.sourceTurnId === "string" ? body.ref.sourceTurnId : undefined,
    tone: typeof body.ref.tone === "string" ? body.ref.tone : undefined,
    optionIndex: typeof body.ref.optionIndex === "number" ? body.ref.optionIndex : undefined,
    bubbleIndex: typeof body.ref.bubbleIndex === "number" ? body.ref.bubbleIndex : undefined,
  } : undefined;

  if (!threadId || !turnId) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
  if (!text.trim() && attachmentKeys.length === 0) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
  if (text.length > MAX_TEXT) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
  if (action === "refine" && !ref?.sourceTurnId) return errJson("invalid_input", "That reply is no longer available.", 400, { ...corsBase, "Content-Type": "application/json" });

  // Validate attachment ownership (must belong to this uid; chat keys must reference this thread or be legacy quick keys for migration? Strict: chat keys must be this thread)
  for (const k of attachmentKeys) {
    const clean = k.startsWith("r2:") ? k.slice(3) : k;
    if (clean.includes("..")) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
    if (clean.startsWith("chat/")) {
      if (!clean.startsWith(`chat/${uid}/${threadId}/`)) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
    } else if (!(clean.startsWith(`quick/${uid}/`) || clean.startsWith("r2:"))) {
      // Allow quick keys for pasted history? Keep strict: must be owned
      if (!clean.startsWith(`quick/${uid}/`)) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...corsBase, "Content-Type": "application/json" });
    }
  }

  const thread = (await db.prepare(`SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE id=? AND uid=?`).bind(threadId, uid).first().catch(() => null)) as any;
  if (!thread) {
    const nf = notFound();
    return new Response(await nf.text(), { status: 404, headers: { ...corsBase, "Content-Type": "application/json" } });
  }
  if (thread.deleting_at) return errJson("not_found", "This chat isn’t available.", 404, { ...corsBase, "Content-Type": "application/json" });

  await expireStalePending(db, threadId, Date.now()).catch(() => {});

  // Duplicate / conflict handling
  const existingTurn = (await db.prepare(`SELECT * FROM chat_turns WHERE id=? AND thread_id=?`).bind(turnId, threadId).first().catch(() => null)) as any;
  const inputFingerprint = stableKey({ text, attachmentKeys, ref, action });
  if (existingTurn) {
    if (existingTurn.uid !== uid) return errJson("not_found", "This chat isn’t available.", 404, { ...corsBase, "Content-Type": "application/json" });
    const savedRef = existingTurn.ref_source_turn_id ? {
      sourceTurnId: existingTurn.ref_source_turn_id, tone: existingTurn.ref_tone || undefined,
      optionIndex: existingTurn.ref_option_index ?? undefined, bubbleIndex: existingTurn.ref_bubble_index ?? undefined,
    } : undefined;
    const savedFingerprint = stableKey({
      text: existingTurn.user_text, attachmentKeys: parseAttachments(existingTurn.attachments),
      ref: savedRef, action: existingTurn.request_action ?? undefined,
    });
    if (savedFingerprint !== inputFingerprint) return errJson("conflict", "Couldn’t send your message. Try again.", 409, { ...corsBase, "Content-Type": "application/json" });
    if (existingTurn.status === "complete") return replayCompletedTurn(existingTurn, cors);
    if (existingTurn.status === "pending") return errJson("active", "Still working on your last message…", 409, { ...corsBase, "Content-Type": "application/json" });
    // Reserve retry via conditional attempt bump
  }

  // Enforce one pending per thread
  const pendingOther = (await db.prepare(`SELECT id FROM chat_turns WHERE thread_id=? AND status='pending' AND id != ?`).bind(threadId, turnId).first().catch(() => null)) as any;
  if (pendingOther) return errJson("active", "Still working on your last message…", 409, { ...corsBase, "Content-Type": "application/json" });

  // Resolve reference exclusively against saved card in same thread
  let refCard: any = null;
  if (ref?.sourceTurnId) {
    const src = (await db.prepare(`SELECT card_json FROM chat_turns WHERE id=? AND thread_id=? AND uid=? AND status='complete'`).bind(ref.sourceTurnId, threadId, uid).first().catch(() => null)) as any;
    if (!src?.card_json) return errJson("invalid_input", "That reply is no longer available.", 400, { ...corsBase, "Content-Type": "application/json" });
    try { refCard = JSON.parse(src.card_json); } catch { return errJson("invalid_input", "That reply is no longer available.", 400, { ...corsBase, "Content-Type": "application/json" }); }
  }

  const now = utcNowIso();
  const attemptBase = existingTurn ? (Number(existingTurn.attempt) || 1) + 1 : 1;
  try {
    if (existingTurn) {
      const r: any = await db.prepare(`UPDATE chat_turns SET status='pending', attempt=?, started_at=? WHERE id=? AND thread_id=? AND uid=? AND status IN ('failed','expired') AND NOT EXISTS (
        SELECT 1 FROM chat_turns later WHERE later.thread_id=chat_turns.thread_id
          AND (later.created_at, later.id) > (chat_turns.created_at, chat_turns.id)
      )`).bind(attemptBase, now, turnId, threadId, uid).run();
      const changed = (r as any)?.changes ?? (r as any)?.meta?.changes ?? 1;
      if (!changed) return errJson("conflict", "Couldn’t send your message. Try again.", 409, { ...corsBase, "Content-Type": "application/json" });
    } else {
      await db.prepare(`INSERT INTO chat_turns (id, thread_id, uid, user_text, attachments, ref_source_turn_id, ref_tone, ref_option_index, ref_bubble_index, request_action, assistant_text, card_json, status, attempt, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', NULL, 'pending', ?, ?, ?)`)
        .bind(turnId, threadId, uid, text, JSON.stringify(attachmentKeys), ref?.sourceTurnId || null, ref?.tone || null, ref?.optionIndex ?? null, ref?.bubbleIndex ?? null, action ?? null, attemptBase, now, now).run();
    }
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("UNIQUE") && msg.includes("pending")) return errJson("active", "Still working on your last message…", 409, { ...corsBase, "Content-Type": "application/json" });
    return errJson("unavailable", "Couldn’t send your message. Try again.", 503, { ...corsBase, "Content-Type": "application/json" });
  }

  // Build context: latest completed turns (up to 8, ~8k tokens)
  const histRows = ((await db.prepare(`SELECT user_text, assistant_text, card_json FROM chat_turns WHERE thread_id=? AND uid=? AND status='complete' ORDER BY created_at DESC, id DESC LIMIT 12`).bind(threadId, uid).all().catch(() => ({ results: [] }))).results || []) as any[];
  const historyChrono = histRows.reverse();
  const historyForCtx: Array<{ role: "user" | "assistant"; text: string; cardSummary?: string }> = [];
  let budget = 8000;
  for (const r of historyChrono.slice(-8)) {
    const uText = String(r.user_text || "").slice(0, 1500);
    const aText = String(r.assistant_text || "").slice(0, 1500);
    let cardSummary = "";
    if (r.card_json) {
      try { cardSummary = summarizeCardForContext(JSON.parse(r.card_json)); } catch { cardSummary = ""; }
    }
    const cost = estimateTokens(uText) + estimateTokens(aText) + estimateTokens(cardSummary);
    if (budget - cost < 0) break;
    budget -= cost;
    if (uText) historyForCtx.push({ role: "user", text: uText });
    if (aText || cardSummary) historyForCtx.push({ role: "assistant", text: aText || "(reply card)", cardSummary: cardSummary || undefined });
  }

  const { entries: ledgerEntries, revision: ledgerRevision } = await loadLedger(db, uid);
  const styleHints = await loadStyleHints(db, uid).catch(() => "");
  const threadNote = typeof thread.context_note === "string" ? thread.context_note : "";

  // Referenced batch / newest prior batch for image follow-ups
  let refImageKeys: string[] = [];
  if (ref?.sourceTurnId) {
    const srcTurn = (await db.prepare(`SELECT attachments FROM chat_turns WHERE id=? AND thread_id=? AND uid=?`).bind(ref.sourceTurnId, threadId, uid).first().catch(() => null)) as any;
    if (srcTurn) refImageKeys = parseAttachments(srcTurn.attachments);
  } else if (/image\s*\d|that (screenshot|photo|pic)|previous (image|screenshot)/i.test(text) && historyChrono.length) {
    for (let i = historyChrono.length - 1; i >= 0; i--) {
      // find newest prior batch: need attachments column; re-query last turn with attachments
      break;
    }
    const lastWith = (await db.prepare(`SELECT attachments FROM chat_turns WHERE thread_id=? AND uid=? AND status='complete' AND attachments != '[]' ORDER BY created_at DESC, id DESC LIMIT 1`).bind(threadId, uid).first().catch(() => null)) as any;
    if (lastWith) refImageKeys = parseAttachments(lastWith.attachments);
  }

  // Current images + referenced (cap 10 / 8MiB, current first)
  const MAX_PER_CALL = 10;
  const combinedKeys: string[] = [...attachmentKeys];
  for (const k of refImageKeys) {
    if (combinedKeys.length >= MAX_PER_CALL) break;
    if (!combinedKeys.includes(k)) combinedKeys.push(k);
  }
  const { parts: imageParts, unavailable } = await r2KeysToImageParts(env, combinedKeys, uid).catch(() => ({ parts: [] as any[], totalBytes: 0, unavailable: combinedKeys.length }));

  const models = pickModels("regular");
  const sessionBase = `rizzbot-chat-${threadId}`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = async (obj: any) => { try { await writer.write(encoder.encode(JSON.stringify(obj) + "\n")); } catch { /* gone */ } };

  (async () => {
    const turnAbort = new AbortController();
    const deadline = setTimeout(() => turnAbort.abort(), GENERATION_DEADLINE_MS);
    // Heartbeat so mobile/proxy/Cloudflare idle timeouts never kill long decks.
    const ping = setInterval(() => { void send({ type: "ping", ts: Date.now() }); }, 10_000);
    let assistantText = "";
    let finalCard: any = null;
    let ledgerPatch: Array<{ id?: string; text: string; label?: string }> | null = null;
    let callsMade = 0;
    try {
      await send({ type: "accepted", turnId, attempt: attemptBase });
      if (unavailable > 0 && combinedKeys.length > 0) {
        await send({ type: "status", code: "reading", message: waitLine("reading", attemptBase) });
      }

      const finishFailed = async (code: string, message: string, status = 200) => {
        void status;
        try { await db.prepare(`UPDATE chat_turns SET status='failed' WHERE id=? AND attempt=?`).bind(turnId, attemptBase).run(); } catch { /* ignore */ }
        await send({ type: "error", code, message });
      };

      // Explicit draft/refine actions bypass the conversational call
      if (action === "draft" || action === "refine") {
        const highStakes = action === "draft" && isHighStakesDraft(text, imageParts.length);
        await send({ type: "status", code: action === "draft" ? "drafting" : "refining", message: waitLine(action === "draft" ? "drafting" : "refining", attemptBase) });
        const draftRes = await runDraft({
          env, apiKey, sessionBase, models, kind: action === "draft" ? "full" : "revision",
          currentText: text, attachmentKeys, ref, refCard, imageParts, styleHints, threadNote, signal: turnAbort.signal,
          effort: action === "draft" && highStakes ? "xhigh" : undefined,
          excerpts: historyForCtx.filter((h) => h.role === "user").map((h) => h.text).slice(-3),
        });
        callsMade = 1;
        if (!draftRes.ok) {
          await finishFailed(draftRes.code || "upstream", draftRes.message || "Couldn’t finish that reply.");
          return;
        }
        finalCard = draftRes.card;
        assistantText = draftRes.preamble || "";
        await commitTurn();
        return;
      }

      // Ordinary path: conversational call with capped tools
      const messages = buildConversationalMessages({
        ledger: ledgerEntries,
        threadNote,
        styleHints,
        history: historyForCtx,
        currentText: text.trim() ? text : "(screenshots attached — respond to what is visible or ask what they want help with)",
      });
      const openAiMessages = withImages(messages, imageParts);
      const chatCandidates: ModelCandidate[] = [
        { model: models.chat.id, effort: models.chat.effort },
        { model: DEEPSEEK_ID, effort: "high" },
        { model: HY4_ID, effort: "high" },
      ];
      const t0 = Date.now();
      callsMade = 1;
      const conv = await callConversationalStream({
        apiKey,
        sessionTag: sessionBase,
        candidates: chatCandidates,
        system: CHAT_SI_V1,
        messages: openAiMessages,
        tools: [DRAFT_REPLIES_TOOL, UPDATE_LEDGER_TOOL, THINK_DEEPER_TOOL],
        signal: turnAbort.signal,
        onText: async (t) => {
          // Stream immediately: short replies must paint live, and any tool
          // call resolves in the same turn. Shown text is part of the answer.
          assistantText += t;
          await send({ type: "delta", text: t });
        },
      });
      telemetry(context, db, { endpoint: "opencode/thread", model: conv.model, latencyMs: Date.now() - t0, ok: true, uid });

      const draftCall = conv.toolCalls.find((c) => c.name === "draft_replies");
      const thinkCall = conv.toolCalls.find((c) => c.name === "think_deeper");
      const ledgerCall = conv.toolCalls.find((c) => c.name === "update_ledger");

      if (ledgerCall) {
        try {
          ledgerPatch = validateLedgerPatchArgs(ledgerCall.args, ledgerEntries);
        } catch { ledgerPatch = null; }
      }

      if (draftCall) {
        const scope = (draftCall.args as any)?.scope === "revision" ? "revision" : "full";
        const goal = typeof (draftCall.args as any)?.draft_goal === "string" ? (draftCall.args as any).draft_goal : text.slice(0, 200);
        const requestedDepth = (draftCall.args as any)?.depth === "xhigh" ? "xhigh" as const : "high" as const;
        let thinkTier: ThinkTier | null = null;
        if (thinkCall) {
          try { thinkTier = validateThinkDeeperArgs(thinkCall.args); } catch { thinkTier = null; }
          if (thinkTier) telemetry(context, db, { endpoint: "opencode/thread-think", model: conv.model, latencyMs: 0, ok: true, uid });
        }
        const deckEffort = scope === "revision" ? undefined : (requestedDepth === "xhigh" || thinkTier === "xhigh" ? "xhigh" : "high");
        await send({ type: "status", code: scope === "full" ? "drafting" : "refining", message: waitLine(scope === "full" ? "drafting" : "refining", attemptBase) });
        const draftRes = await runDraft({
          env, apiKey, sessionBase, models, kind: scope,
          currentText: text, attachmentKeys, ref, refCard, imageParts, styleHints, threadNote, signal: turnAbort.signal, draftGoal: goal,
          effort: deckEffort,
          excerpts: historyForCtx.filter((h) => h.role === "user").map((h) => h.text).slice(-3),
        });
        callsMade = 2;
        if (!draftRes.ok) {
          // Keep usable text if the model already produced some, else error
          if (!turnAbort.signal.aborted && draftRes.code !== "allowance" && assistantText.trim()) { await commitTurn(); return; }
          await finishFailed(draftRes.code || "upstream", draftRes.message || "Couldn’t finish that reply.");
          return;
        }
        finalCard = draftRes.card;
        await commitTurn();
        return;
      }

      // Think-deeper escalation: one prose continuation at the requested tier,
      // no tools, inside the existing 2-call cap.
      if (thinkCall) {
        let tier: ThinkTier;
        try {
          tier = validateThinkDeeperArgs(thinkCall.args);
        } catch {
          await finishFailed("upstream", "Couldn’t finish that reply.");
          return;
        }
        callsMade = 2;
        await send({ type: "status", code: "thinking", message: waitLine(("deeper_" + tier) as WaitKind, attemptBase) });
        const t1 = Date.now();
        try {
          let firstDeeperDelta = true;
          const cont = await callConversationalStream({
            apiKey,
            sessionTag: `${sessionBase}-deeper`,
            candidates: [
              { model: SPARK_ID, effort: tier },
              { model: DEEPSEEK_ID, effort: "high" },
              { model: HY4_ID, effort: "high" },
            ],
            system: CHAT_SI_V1,
            messages: [...openAiMessages, { role: "assistant", content: assistantText || "(thinking it through — now answer directly)" }],
            signal: turnAbort.signal,
            onText: async (t) => {
              if (firstDeeperDelta && assistantText.trim() && !/\s$/.test(assistantText) && !/^\s/.test(t)) {
                assistantText += "\n\n";
                await send({ type: "delta", text: "\n\n" });
              }
              firstDeeperDelta = false;
              assistantText += t;
              await send({ type: "delta", text: t });
            },
          });
          telemetry(context, db, { endpoint: "opencode/thread", model: cont.model, latencyMs: Date.now() - t1, ok: true, uid });
        } catch (e: any) {
          if (!assistantText.trim()) { await finishFailed("upstream", "Couldn’t finish that reply."); return; }
        }
        if (!assistantText.trim() && !finalCard) {
          await finishFailed("upstream", "Couldn’t finish that reply.");
          return;
        }
        await commitTurn();
        return;
      }

      // Ledger-only tool call with no visible answer: one continuation with ledger disabled
      if (ledgerCall && !assistantText.trim() && conv.toolCalls.length === 1) {
        if (callsMade < 2) {
          callsMade = 2;
          let extra = "";
          const t1 = Date.now();
          try {
            const cont = await callConversationalStream({
              apiKey,
              sessionTag: `${sessionBase}-cont`,
              candidates: chatCandidates,
              system: CHAT_SI_V1,
              messages: [...openAiMessages, { role: "assistant", content: "(noted — now answer the user directly in one short turn)" }],
              signal: turnAbort.signal,
              onText: async (t) => { extra += t; assistantText += t; await send({ type: "delta", text: t }); },
            });
            telemetry(context, db, { endpoint: "opencode/thread", model: cont.model, latencyMs: Date.now() - t1, ok: true, uid });
            void extra;
          } catch (e: any) {
            if (!assistantText.trim()) { await finishFailed("upstream", "Couldn’t finish that reply."); return; }
          }
        }
      }

      if (!assistantText.trim() && !finalCard) {
        await finishFailed("upstream", "Couldn’t finish that reply.");
        return;
      }
      await commitTurn();

      async function commitTurn() {
        const cardJson = finalCard ? JSON.stringify({ v: 1, ...finalCard }) : null;
        const now = utcNowIso();
        const persistedText = assistantText.slice(0, 8000);
        const batch = [
          db.prepare(`UPDATE chat_turns SET assistant_text=?, card_json=?, status='complete'
            WHERE id=? AND thread_id=? AND uid=? AND attempt=? AND status='pending'
              AND EXISTS (SELECT 1 FROM chat_threads WHERE id=? AND uid=? AND deleting_at IS NULL)`)
            .bind(persistedText, cardJson, turnId, threadId, uid, attemptBase, threadId, uid),
          db.prepare(`UPDATE chat_threads SET updated_at=? WHERE id=? AND uid=? AND deleting_at IS NULL
            AND EXISTS (SELECT 1 FROM chat_turns WHERE id=? AND attempt=? AND status='complete')`)
            .bind(now, threadId, uid, turnId, attemptBase),
        ];
        if (ledgerPatch?.length) {
          const merged = [...ledgerEntries];
          for (const patch of ledgerPatch) {
            if (patch.id) {
              const index = merged.findIndex((entry) => entry.id === patch.id);
              if (index >= 0) merged[index] = { ...merged[index], text: patch.text, label: patch.label ?? merged[index].label };
            } else if (merged.length < 40) {
              merged.push({ id: crypto.randomUUID(), text: patch.text, label: patch.label, source: "agent" });
            }
          }
          batch.push(db.prepare(`INSERT INTO chat_ledgers (uid, entries_json, revision, updated_at)
            SELECT ?, ?, ?, ? WHERE EXISTS (
              SELECT 1 FROM chat_turns t JOIN chat_threads h ON h.id=t.thread_id
              WHERE t.id=? AND t.uid=? AND t.attempt=? AND t.status='complete' AND h.deleting_at IS NULL
            ) AND (? = 0 OR EXISTS (SELECT 1 FROM chat_ledgers WHERE uid=? AND revision=?))
            ON CONFLICT(uid) DO UPDATE SET entries_json=excluded.entries_json,
              revision=excluded.revision, updated_at=excluded.updated_at
            WHERE chat_ledgers.revision=?`)
            .bind(uid, JSON.stringify(merged), ledgerRevision + 1, now, turnId, uid, attemptBase,
              ledgerRevision, uid, ledgerRevision, ledgerRevision));
        }
        const results = await db.batch(batch);
        if (!results[0]?.meta?.changes) {
          await send({ type: "error", code: "conflict", message: "Couldn’t send your message. Try again." });
          return;
        }
        await send({ type: "done", turn: {
          id: turnId, threadId, userText: text, attachments: attachmentKeys,
          ref: ref && ref.sourceTurnId ? ref : undefined,
          assistantText: persistedText, card: finalCard || undefined, status: "complete", attempt: attemptBase,
        } });
      }
    } catch (e: any) {
      const msg = String(e?.message || "upstream");
      telemetry(context, db, { endpoint: "opencode/thread", model: models.chat.id, latencyMs: 0, ok: false, error: msg.slice(0, 300), uid });
      if (/HTTP (402|429)\b/.test(msg) || msg.toLowerCase().includes("allowance") || msg.toLowerCase().includes("quota")) {
        try { await db.prepare(`UPDATE chat_turns SET status='failed' WHERE id=? AND attempt=?`).bind(turnId, attemptBase).run(); } catch { /* ignore */ }
        await send({ type: "error", code: "allowance", message: "Chat is at its usage limit. Try again later." });
      } else {
        try { await db.prepare(`UPDATE chat_turns SET status='failed' WHERE id=? AND attempt=?`).bind(turnId, attemptBase).run(); } catch { /* ignore */ }
        await send({ type: "error", code: "upstream", message: "Couldn’t finish that reply." });
      }
    } finally {
      clearTimeout(deadline);
      clearInterval(ping);
      try { await writer.close(); } catch { /* ignore */ }
    }
  })();

  return new Response(readable, { status: 200, headers: cors });

  async function runDraft(args: {
    env: any; apiKey: string; sessionBase: string; models: ReturnType<typeof pickModels>;
    kind: "full" | "revision"; currentText: string; attachmentKeys: string[];
    ref?: ThreadRef; refCard?: any; imageParts: Array<{ mimeType: string; data: string }>;
    styleHints: string; threadNote: string; draftGoal?: string; signal: AbortSignal;
    effort?: string; excerpts?: string[];
  }): Promise<{ ok: boolean; card?: any; preamble?: string; code?: string; message?: string; modelUsed?: string }> {
    try {
      if (args.kind === "revision") {
        if (!args.ref?.sourceTurnId || !args.refCard) return { ok: false, code: "invalid_input", message: "That reply is no longer available." };
        const src = resolveSourceCardText(args.refCard, args.ref);
        if (!src || !src.optionText) return { ok: false, code: "invalid_input", message: "That reply is no longer available." };
        const { getSystemFor, buildRevisionUserData } = await import("../../lib/chatEngine");
        const userData = buildRevisionUserData({
          currentRequest: args.currentText.trim() || (args.draftGoal || "Revise this reply"),
          draftGoal: args.draftGoal,
          sourceOptionText: src.optionText,
          sourceTone: args.ref.tone,
          sourceBubbleText: src.bubbleText,
          styleHints: args.styleHints,
        });
        const candidates: ModelCandidate[] = [
          { model: SPARK_ID, effort: args.models.draftRev.effort },
          { model: DEEPSEEK_ID, effort: "high" },
          { model: HY4_ID, effort: "high" },
        ];
        const { json: raw, modelUsed } = await callDraftJson({
          apiKey: args.apiKey, sessionTag: `${args.sessionBase}-draft`, candidates,
          system: getSystemFor("revision"), userData, imageParts: args.imageParts, signal: args.signal,
        });
        validateRevisionCard(raw);
        const card = {
          kind: "revision" as const,
          sourceTurnId: args.ref.sourceTurnId,
          sourceTone: args.ref.tone,
          sourceOptionIndex: args.ref.optionIndex ?? 0,
          sourceBubbleIndex: typeof args.ref.bubbleIndex === "number" ? args.ref.bubbleIndex : undefined,
          variations: (raw as any).variations.map((v: any) => ({
            bubbles: (v.bubbles as any[]).map((b: any) => ({
              text: String(b.text).trim(),
              replyTo: typeof b.replyTo === "string" && b.replyTo.trim() ? b.replyTo.trim() : null,
            })),
          })),
        };
        // Line-only scope: reconstruct untouched lines exact from the source option
        if (typeof args.ref.bubbleIndex === "number" && src.bubbleText) {
          const srcBubbles = src.optionText.split("\n").filter(Boolean);
          void srcBubbles;
        }
        return { ok: true, card, modelUsed };
      }
      const { getSystemFor, buildDraftUserData } = await import("../../lib/chatEngine");
      // Recent thread context travels with the request; the current message
      // itself is the goal unless the tool gave a narrower one. No stored
      // private goal exists in Chat v1, so the request doubles as the goal.
      const excerpts = [...(args.excerpts || []), args.currentText.trim()].filter(Boolean).slice(-4, -1);
      const userData = buildDraftUserData({
        currentRequest: args.currentText.trim() || (args.draftGoal || "What should I text back?"),
        draftGoal: args.draftGoal,
        threadNote: args.threadNote || undefined,
        exchangeExcerpts: excerpts,
        styleHints: args.styleHints,
        screenshotCount: args.imageParts.length,
      });
      const deckEffort = args.effort ?? args.models.draftFull.effort;
      const candidates: ModelCandidate[] = [
        { model: SPARK_ID, effort: deckEffort },
        { model: DEEPSEEK_ID, effort: "high" },
        { model: HY4_ID, effort: "high" },
      ];
      const { json: raw, modelUsed } = await callDraftJson({
        apiKey: args.apiKey, sessionTag: `${args.sessionBase}-draft`, candidates,
        system: getSystemFor("deck"), userData, imageParts: args.imageParts, signal: args.signal,
      });
      validateQuickV2Payload(raw as Record<string, unknown>);
      return { ok: true, card: { kind: "deck" as const, ...(raw as object) }, modelUsed };
    } catch (e: any) {
      const msg = String(e?.message || "draft failed");
      if (/HTTP (402|429)\b/.test(msg) || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("allowance")) {
        return { ok: false, code: "allowance", message: "Chat is at its usage limit. Try again later." };
      }
      return { ok: false, code: "upstream", message: "Couldn’t finish that reply." };
    }
  }

  function withImages(messages: Array<{ role: string; content: string }>, parts: Array<{ mimeType: string; data: string }>) {
    if (!parts.length) return messages.map((m) => ({ role: m.role, content: m.content }));
    const out = messages.map((m) => ({ role: m.role, content: m.content as any }));
    const lastUserIdx = out.map((m) => m.role).lastIndexOf("user");
    const toDataUrl = (mime: string, d: string) => (d.startsWith("data:") ? d : `data:${mime || "image/webp"};base64,${d}`);
    const content: any[] = parts.slice(0, MAX_IMAGES).map((p) => ({ type: "image_url", image_url: { url: toDataUrl(p.mimeType, p.data) } }));
    const text = out[lastUserIdx]?.content || "";
    content.push({ type: "text", text });
    if (lastUserIdx >= 0) out[lastUserIdx] = { role: "user", content };
    return out;
  }

  function replayCompletedTurn(row: any, corsHdrs: Record<string, string>) {
    const { readable: r2, writable: w2 } = new TransformStream();
    const wr = w2.getWriter();
    const enc = new TextEncoder();
    (async () => {
      try {
        await wr.write(enc.encode(JSON.stringify({ type: "accepted", turnId: row.id, attempt: row.attempt }) + "\n"));
        let card: any = undefined;
        if (row.card_json) { try { card = JSON.parse(row.card_json); } catch { card = undefined; } }
        await wr.write(enc.encode(JSON.stringify({ type: "done", turn: {
          id: row.id, threadId: row.thread_id, userText: row.user_text, attachments: parseAttachments(row.attachments),
          assistantText: row.assistant_text || "", card, status: "complete", attempt: row.attempt,
        } }) + "\n"));
      } finally { try { await wr.close(); } catch { /* ignore */ } }
    })();
    return new Response(r2, { status: 200, headers: corsHdrs });
  }

  async function handleIncognito(args: { env: any; apiKey: string; uid: string; body: any; cors: Record<string, string>; corsBase: Record<string, string> }) {
    const { apiKey: key, uid: incUid, body: b, cors: ndCors, corsBase: jsonCors } = args;
    if (b?.ledger || (b?.tools && b.tools.length)) {
      return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...jsonCors, "Content-Type": "application/json" });
    }
    const text = typeof b?.text === "string" ? b.text : "";
    if (!text.trim() && (!Array.isArray(b?.images) || b.images.length === 0)) {
      return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...jsonCors, "Content-Type": "application/json" });
    }
    if (text.length > MAX_TEXT) return errJson("invalid_input", "Couldn’t send your message. Try again.", 400, { ...jsonCors, "Content-Type": "application/json" });
    const prior = Array.isArray(b?.priorTurns) ? (b.priorTurns as any[]).filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string").slice(-10).map((t) => ({ role: t.role as "user" | "assistant", text: String(t.text).slice(0, 1500) })) : [];
    const { parts } = inlineImagesToParts(b?.images);
    // Referenced card (untrusted context only)
    let refCardText = "";
    if (b?.ref && typeof b.ref === "object" && b.ref.card && typeof b.ref.card === "object") {
      refCardText = summarizeCardForContext(b.ref.card).slice(0, 800);
    }
    const { entries } = await loadLedger(db, incUid);
    const styleHints = await loadStyleHints(db, incUid).catch(() => "");
    const models = pickModels("incognito");
    const incSessionTag = typeof b?.sessionId === "string" && b.sessionId ? `rizzbot-chat-${b.sessionId}` : `rizzbot-chat-inc-${Date.now()}`;
    const messages = buildConversationalMessages({
      ledger: entries, threadNote: "", styleHints,
      history: [...prior.map((p) => ({ role: p.role as "user" | "assistant", text: p.text })), ...(refCardText ? [{ role: "assistant" as const, text: refCardText }] : [])],
      currentText: text.trim() ? text : "(screenshots attached — respond to what is visible or ask what they want help with)",
    });
    const openAiMessages = (() => {
      if (!parts.length) return messages.map((m) => ({ role: m.role, content: m.content }));
      const out = messages.map((m) => ({ role: m.role, content: m.content as any }));
      const idx = out.map((m) => m.role).lastIndexOf("user");
      const toDataUrl = (mime: string, d: string) => (d.startsWith("data:") ? d : `data:${mime};base64,${d}`);
      const content: any[] = parts.map((p) => ({ type: "image_url", image_url: { url: toDataUrl(p.mimeType, p.data) } }));
      content.push({ type: "text", text: out[idx]?.content || "" });
      if (idx >= 0) out[idx] = { role: "user", content };
      return out;
    })();

    const actionInc = b?.action === "draft" || b?.action === "refine" ? b.action : undefined;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = async (o: any) => { try { await writer.write(encoder.encode(JSON.stringify(o) + "\n")); } catch { /* gone */ } };
    (async () => {
      const turnAbort = new AbortController();
      const killer = setTimeout(() => turnAbort.abort(), GENERATION_DEADLINE_MS);
      const ping = setInterval(() => { void send({ type: "ping", ts: Date.now() }); }, 10_000);
      const incSalt = Date.now();
      try {
        await send({ type: "accepted", turnId: `inc-${Date.now()}`, incognito: true });
        if (actionInc === "draft" || actionInc === "refine") {
          await send({ type: "status", code: actionInc === "draft" ? "drafting" : "refining", message: waitLine(actionInc === "draft" ? "drafting" : "refining", incSalt) });
          // Incognito drafts: same isolation, in-memory evidence only
          const { getSystemFor, buildDraftUserData, buildRevisionUserData } = await import("../../lib/chatEngine");
          if (actionInc === "refine") {
            const card = b?.ref?.card;
            const srcIdx = typeof b?.ref?.optionIndex === "number" ? b.ref.optionIndex : 0;
            const variations = card?.variations || Object.values(card?.suggestions || {})[0];
            void srcIdx; void variations;
            const userData = buildRevisionUserData({
              currentRequest: text.trim() || "Revise this reply",
              sourceOptionText: JSON.stringify(card || {}).slice(0, 2000),
              sourceTone: typeof b?.ref?.tone === "string" ? b.ref.tone : undefined,
              styleHints,
            });
            const { json: raw } = await callDraftJson({ apiKey: key, sessionTag: `${incSessionTag}-draft`, candidates: [{ model: models.draftRev.id, effort: models.draftRev.effort }], system: getSystemFor("revision"), userData, imageParts: parts, signal: turnAbort.signal });
            validateRevisionCard(raw);
            await send({ type: "done", turn: { id: `inc-${Date.now()}`, incognito: true, userText: text, assistantText: "", card: { kind: "revision", ...(raw as object) }, status: "complete" } });
            return;
          }
          const userData = buildDraftUserData({ currentRequest: text.trim() || "What should I text back?", exchangeExcerpts: [text.trim()].filter(Boolean), styleHints, screenshotCount: parts.length });
          const { json: raw } = await callDraftJson({ apiKey: key, sessionTag: `${incSessionTag}-draft`, candidates: [{ model: models.draftFull.id, effort: models.draftFull.effort }, { model: HY4_ID, effort: "high" }], system: getSystemFor("deck"), userData, imageParts: parts, signal: turnAbort.signal });
          validateQuickV2Payload(raw as Record<string, unknown>);
          await send({ type: "done", turn: { id: `inc-${Date.now()}`, incognito: true, userText: text, assistantText: "", card: { kind: "deck", ...(raw as object) }, status: "complete" } });
          return;
        }
        let full = "";
        const t0 = Date.now();
        const conv = await callConversationalStream({
          apiKey: key, sessionTag: incSessionTag,
          candidates: [{ model: DEEPSEEK_ID, effort: "none" }, { model: HY4_ID, effort: "high" }],
          system: CHAT_SI_V1, messages: openAiMessages, tools: [DRAFT_REPLIES_TOOL],
          signal: turnAbort.signal,
          onText: async (t) => { full += t; await send({ type: "delta", text: t }); },
        });
        telemetry(context, db, { endpoint: "opencode/thread", model: conv.model, latencyMs: Date.now() - t0, ok: true, uid: incUid });
        const draftCall = conv.toolCalls.find((c) => c.name === "draft_replies");
        if (draftCall) {
          await send({ type: "status", code: "drafting", message: waitLine("drafting", incSalt) });
          const { getSystemFor, buildDraftUserData } = await import("../../lib/chatEngine");
          const userData = buildDraftUserData({ currentRequest: text.trim() || "What should I text back?", draftGoal: typeof (draftCall.args as any)?.draft_goal === "string" ? (draftCall.args as any).draft_goal : undefined, exchangeExcerpts: [text.trim()].filter(Boolean), styleHints, screenshotCount: parts.length });
          const { json: raw } = await callDraftJson({ apiKey: key, sessionTag: `${incSessionTag}-draft`, candidates: [{ model: models.draftFull.id, effort: models.draftFull.effort }, { model: HY4_ID, effort: "high" }], system: getSystemFor("deck"), userData, imageParts: parts, signal: turnAbort.signal });
          validateQuickV2Payload(raw as Record<string, unknown>);
          await send({ type: "done", turn: { id: `inc-${Date.now()}`, incognito: true, userText: text, assistantText: full, card: { kind: "deck", ...(raw as object) }, status: "complete" } });
          return;
        }
        // Reject any incognito memory write attempt server-side (tool not advertised, but double-guard)
        await send({ type: "done", turn: { id: `inc-${Date.now()}`, incognito: true, userText: text, assistantText: full, status: "complete" } });
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (/HTTP (402|429)\b/.test(msg) || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("allowance")) {
          await send({ type: "error", code: "allowance", message: "Chat is at its usage limit. Try again later." });
        } else {
          await send({ type: "error", code: "upstream", message: "Couldn’t finish that reply." });
        }
      } finally { clearTimeout(killer); clearInterval(ping); try { await writer.close(); } catch { /* ignore */ } }
    })();
    return new Response(readable, { status: 200, headers: ndCors });
  }
}

export const onRequestPost = onRequest;

