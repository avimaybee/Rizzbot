import { corsHeadersFor } from "../../lib/cors";
import {
  checkChatAllowlist,
  deriveTitleFromText,
  ensureChatSchema,
  expireStalePendingForUser,
  isUuidLike,
  resolveChatDb,
  trimTitle,
  utcNowIso,
} from "../../lib/chatStore";

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const cors = { ...corsHeadersFor(request), "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const uid = data?.user?.uid as string | undefined;
  if (!uid) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  if (!checkChatAllowlist(env, uid)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: cors });
  }

  const db = resolveChatDb(env);
  if (!db) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
  await ensureChatSchema(db);

  if (request.method === "GET") {
    await expireStalePendingForUser(db, uid, Date.now()).catch(() => {});
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") || "";
    const limit = 30;
    let rows: any[];
    try {
      const existsFilter = `EXISTS (SELECT 1 FROM chat_turns t WHERE t.thread_id = chat_threads.id)`;
      if (cursor) {
        const [cTs, cId] = cursor.split("|");
        rows = (
          await db
            .prepare(
              `SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE uid=? AND deleting_at IS NULL AND ${existsFilter} AND ((updated_at < ?) OR (updated_at = ? AND id < ?)) ORDER BY updated_at DESC, id DESC LIMIT ?`
            )
            .bind(uid, cTs, cTs, cId, limit + 1)
            .all()
        ).results || [];
      } else {
        rows = (
          await db
            .prepare(
              `SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE uid=? AND deleting_at IS NULL AND ${existsFilter} ORDER BY updated_at DESC, id DESC LIMIT ?`
            )
            .bind(uid, limit + 1)
            .all()
        ).results || [];
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
    }
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? `${(page[page.length - 1] as any).updated_at}|${(page[page.length - 1] as any).id}`
      : null;
    return new Response(JSON.stringify({ threads: page, nextCursor }), { status: 200, headers: cors });
  }

  if (request.method === "POST") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!isUuidLike(id)) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    const rawTitle = typeof body?.title === "string" ? body.title : "";
    const title = trimTitle(rawTitle) || deriveTitleFromText(typeof body?.initialText === "string" ? body.initialText : rawTitle);
    const contextNote = typeof body?.context_note === "string" ? body.context_note.slice(0, 2000) : "";
    const now = utcNowIso();
    try {
      const existing = await db.prepare(`SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE id=? AND uid=?`).bind(id, uid).first();
      if (existing) {
        return new Response(JSON.stringify({ thread: existing }), { status: 200, headers: cors });
      }
      await db
        .prepare(`INSERT INTO chat_threads (id, uid, title, context_note, deleting_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)`)
        .bind(id, uid, title.slice(0, 56), contextNote, now, now)
        .run();
      const row = await db.prepare(`SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE id=?`).bind(id).first();
      return new Response(JSON.stringify({ thread: row }), { status: 200, headers: cors });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("UNIQUE") || msg.includes("PRIMARY")) {
        const row = await db.prepare(`SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE id=? AND uid=?`).bind(id, uid).first().catch(() => null);
        if (row) return new Response(JSON.stringify({ thread: row }), { status: 200, headers: cors });
      }
      return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
    }
  }

  return new Response(JSON.stringify({ error: "invalid_input" }), { status: 405, headers: cors });
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
