import { corsHeadersFor } from "../../../../lib/cors";
import { checkChatAllowlist, ensureChatSchema, resolveChatDb, utcNowIso } from "../../../../lib/chatStore";
import { base64ToBytes } from "../../../../lib/json";

const MAX_IMAGES = 10;
const MAX_SINGLE_IMAGE_BYTES = 2 * 1024 * 1024;

function threadIdFromUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "threads");
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch { /* ignore */ }
  return "";
}

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const cors = { ...corsHeadersFor(request), "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "invalid_input" }), { status: 405, headers: cors });

  const uid = data?.user?.uid as string | undefined;
  if (!uid) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  if (!checkChatAllowlist(env, uid, data?.user?.email)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: cors });
  }
  const db = resolveChatDb(env);
  if (!db) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
  await ensureChatSchema(db);

  const threadId = threadIdFromUrl(request.url);
  if (!threadId) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });
  const thread = (await db.prepare(`SELECT id, deleting_at FROM chat_threads WHERE id=? AND uid=?`).bind(threadId, uid).first().catch(() => null)) as any;
  if (!thread || thread.deleting_at) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
  }
  const turnId = typeof body?.turnId === "string" ? body.turnId.trim() : "";
  if (!turnId) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
  const images = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (images.length === 0) return new Response(JSON.stringify({ keys: [] }), { status: 200, headers: cors });

  const bucket = (env as any).RIZZBOT_MEDIA;
  if (!bucket) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });

  const keys: string[] = [];
  const now = Date.now();
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || typeof img.data !== "string" || !img.data.trim()) continue;
    if (img.data.length > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "invalid_input", message: "Image data too large" }), { status: 413, headers: cors });
    }
    let bytes: Uint8Array;
    try { bytes = base64ToBytes(img.data); } catch {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }
    if (bytes.byteLength > MAX_SINGLE_IMAGE_BYTES) {
      return new Response(JSON.stringify({ error: "invalid_input", message: `Image at index ${i} exceeds 2MB compressed limit` }), { status: 413, headers: cors });
    }
    const mimeType = img.mimeType === "image/png" || img.mimeType === "image/jpeg" || img.mimeType === "image/webp" ? img.mimeType : "image/webp";
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
    // Deterministic per (turn, index, attachment id) so retries reuse bytes. Include random suffix only when attachmentId missing.
    const attachmentId = typeof img.id === "string" && img.id ? img.id.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 24) : `${now}-${i}-${crypto.randomUUID().slice(0, 6)}`;
    const objectKey = `chat/${uid}/${threadId}/${turnId}/${i}-${attachmentId}.${ext}`;
    // Re-check thread still active after (potential) slow upload loop start
    try {
      await bucket.put(objectKey, bytes, { httpMetadata: { contentType: mimeType, cacheControl: "private, no-store" } });
    } catch {
      return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
    }
    keys.push(`r2:${objectKey}`);
  }

  // If thread was deleted mid-upload, remove what we just wrote
  const stillThere = await db.prepare(`SELECT id FROM chat_threads WHERE id=? AND uid=? AND deleting_at IS NULL`).bind(threadId, uid).first().catch(() => null);
  if (!stillThere) {
    await Promise.all(keys.map((k) => bucket.delete(k.replace(/^r2:/, "")).catch(() => {})));
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });
  }

  // Bump thread timestamp (best effort)
  try { await db.prepare(`UPDATE chat_threads SET updated_at=? WHERE id=? AND uid=?`).bind(utcNowIso(), threadId, uid).run(); } catch { /* ignore */ }

  return new Response(JSON.stringify({ keys }), { status: 200, headers: cors });
}

export const onRequestPost = onRequest;
