import { corsHeadersFor } from "../../../lib/cors";
import {
  checkChatAllowlist,
  ensureChatSchema,
  expireStalePending,
  notFound,
  parseAttachments,
  resolveChatDb,
  trimTitle,
  utcNowIso,
} from "../../../lib/chatStore";

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

  const uid = data?.user?.uid as string | undefined;
  if (!uid) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  if (!checkChatAllowlist(env, uid)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: cors });
  }
  const db = resolveChatDb(env);
  if (!db) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
  await ensureChatSchema(db);

  const threadId = threadIdFromUrl(request.url);
  if (!threadId) return notFound();

  const thread = (await db.prepare(`SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE id=? AND uid=?`).bind(threadId, uid).first().catch(() => null)) as any;
  if (!thread) {
    return new Response(JSON.stringify({ error: "not_found", message: "This chat isn’t available." }), { status: 404, headers: cors });
  }

  if (request.method === "GET") {
    const url = new URL(request.url);
    const exactTurnId = url.searchParams.get("turnId") || "";
    const cursor = url.searchParams.get("cursor") || "";
    await expireStalePending(db, threadId, Date.now()).catch(() => {});
    if (exactTurnId) {
      const turn = await db.prepare(`SELECT * FROM chat_turns WHERE id=? AND thread_id=? AND uid=?`).bind(exactTurnId, threadId, uid).first().catch(() => null);
      if (!turn) return notFound();
      return new Response(JSON.stringify({ thread, turn: serializeTurn(turn) }), { status: 200, headers: cors });
    }
    const limit = 30;
    let rows: any[];
    if (cursor) {
      const [cTs, cId] = cursor.split("|");
      rows = (
        await db.prepare(`SELECT * FROM chat_turns WHERE thread_id=? AND uid=? AND ((created_at < ?) OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?`)
          .bind(threadId, uid, cTs, cTs, cId, limit + 1).all().catch(() => ({ results: [] }))
      ).results || [];
    } else {
      rows = (
        await db.prepare(`SELECT * FROM chat_turns WHERE thread_id=? AND uid=? ORDER BY created_at DESC, id DESC LIMIT ?`)
          .bind(threadId, uid, limit + 1).all().catch(() => ({ results: [] }))
      ).results || [];
    }
    const hasMore = rows.length > limit;
    const pageDesc = hasMore ? rows.slice(0, limit) : rows;
    const page = pageDesc.reverse().map(serializeTurn);
    const lastDesc: any = pageDesc[pageDesc.length - 1];
    const nextCursor = hasMore && lastDesc ? `${lastDesc.created_at}|${lastDesc.id}` : null;
    return new Response(JSON.stringify({ thread, turns: page, nextCursor }), { status: 200, headers: cors });
  }

  if (request.method === "PATCH") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }
    if (thread.deleting_at) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });

    const hasTitle = typeof body?.title === "string";
    const hasNote = typeof body?.context_note === "string";
    if (!hasTitle && !hasNote) {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }

    const now = utcNowIso();
    if (hasTitle) {
      const title = trimTitle(body.title);
      if (!title) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
      if (hasNote) {
        const note = body.context_note.trim().slice(0, 1000);
        await db.prepare(`UPDATE chat_threads SET title=?, title_manual=1, context_note=?, updated_at=? WHERE id=? AND uid=?`).bind(title, note, now, threadId, uid).run();
      } else {
        await db.prepare(`UPDATE chat_threads SET title=?, title_manual=1, updated_at=? WHERE id=? AND uid=?`).bind(title, now, threadId, uid).run();
      }
    } else if (hasNote) {
      const note = body.context_note.trim().slice(0, 1000);
      await db.prepare(`UPDATE chat_threads SET context_note=?, updated_at=? WHERE id=? AND uid=?`).bind(note, now, threadId, uid).run();
    }

    const updated = await db.prepare(`SELECT id, title, context_note, deleting_at, created_at, updated_at FROM chat_threads WHERE id=? AND uid=?`).bind(threadId, uid).first();
    return new Response(JSON.stringify({ thread: updated }), { status: 200, headers: cors });
  }

  if (request.method === "POST") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }
    if (thread.deleting_at) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });

    const action = body?.action;
    const turnId = typeof body?.turnId === "string" ? body.turnId.trim() : "";

    if (action === "abort_pending" && turnId) {
      await db.prepare(`UPDATE chat_turns SET status='failed' WHERE id=? AND thread_id=? AND uid=? AND status='pending'`).bind(turnId, threadId, uid).run().catch(() => {});
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    }

    if (action === "rewind_to" && turnId) {
      const keepAnchorMedia = Boolean(body?.keepAnchorMedia);
      const anchor = (await db.prepare(`SELECT id, created_at FROM chat_turns WHERE id=? AND thread_id=? AND uid=?`).bind(turnId, threadId, uid).first().catch(() => null)) as any;
      if (!anchor) return notFound();
      const doomed = ((await db.prepare(
        `SELECT id, attachments FROM chat_turns WHERE thread_id=? AND uid=? AND ((created_at > ?) OR (created_at = ? AND id >= ?))`
      ).bind(threadId, uid, anchor.created_at, anchor.created_at, anchor.id).all().catch(() => ({ results: [] }))).results || []) as any[];

      const bucket = (env as any).RIZZBOT_MEDIA;
      if (bucket && doomed.length) {
        const keys: string[] = [];
        for (const r of doomed) {
          if (keepAnchorMedia && r.id === turnId) continue;
          for (const k of parseAttachments(r.attachments)) {
            const clean = k.startsWith("r2:") ? k.slice(3) : k;
            if (clean.startsWith(`chat/${uid}/${threadId}/`)) keys.push(clean);
          }
        }
        if (keys.length) {
          await Promise.all(keys.map((k) => bucket.delete(k).catch(() => {})));
        }
      }

      await db.batch([
        db.prepare(`DELETE FROM chat_turns WHERE thread_id=? AND uid=? AND ((created_at > ?) OR (created_at = ? AND id >= ?))`).bind(threadId, uid, anchor.created_at, anchor.created_at, anchor.id),
        db.prepare(`UPDATE chat_threads SET updated_at=? WHERE id=? AND uid=?`).bind(utcNowIso(), threadId, uid),
      ]);
      return new Response(JSON.stringify({ ok: true, deletedTurnIds: doomed.map((d) => d.id) }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
  }

  if (request.method === "DELETE") {
    const now = utcNowIso();
    try {
      await db.prepare(`UPDATE chat_threads SET deleting_at=?, updated_at=? WHERE id=? AND uid=? AND deleting_at IS NULL`).bind(now, now, threadId, uid).run();
    } catch { /* ignore */ }
    // Best-effort R2 prefix delete
    const bucket = (env as any).RIZZBOT_MEDIA;
    const prefix = `chat/${uid}/${threadId}/`;
    if (bucket) {
      try {
        let cursor: string | undefined = undefined;
        for (let i = 0; i < 20; i++) {
          const listed: any = await bucket.list({ prefix, limit: 500, cursor });
          const objs: any[] = listed?.objects || [];
          if (objs.length) {
            await Promise.all(objs.map((o: any) => bucket.delete(o.key).catch(() => {})));
          }
          if (listed?.truncated && listed?.cursor) cursor = listed.cursor;
          else break;
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "unavailable", message: "Couldn’t finish deleting. Try again.", threadId }), { status: 503, headers: cors });
      }
    }
    try {
      await db.batch([
        db.prepare(`DELETE FROM chat_turns WHERE thread_id=? AND uid=?`).bind(threadId, uid),
        db.prepare(`DELETE FROM chat_threads WHERE id=? AND uid=?`).bind(threadId, uid),
      ]);
    } catch {
      return new Response(JSON.stringify({ error: "unavailable", message: "Couldn’t finish deleting. Try again." }), { status: 503, headers: cors });
    }
    return new Response(JSON.stringify({ deleted: threadId }), { status: 200, headers: cors });
  }

  return new Response(JSON.stringify({ error: "invalid_input" }), { status: 405, headers: cors });
}

function serializeTurn(row: any) {
  let replyQuote: any = undefined;
  if (row.reply_quote) {
    try { replyQuote = JSON.parse(row.reply_quote); } catch { replyQuote = undefined; }
  }
  return {
    id: row.id,
    threadId: row.thread_id,
    userText: row.user_text || "",
    attachments: parseAttachments(row.attachments),
    action: row.request_action || undefined,
    replyQuote,
    ref: row.ref_source_turn_id ? {
      sourceTurnId: row.ref_source_turn_id,
      tone: row.ref_tone || undefined,
      optionIndex: typeof row.ref_option_index === "number" ? row.ref_option_index : undefined,
      bubbleIndex: typeof row.ref_bubble_index === "number" ? row.ref_bubble_index : undefined,
    } : undefined,
    assistantText: row.assistant_text || "",
    card: row.card_json ? safeParseCard(row.card_json) : undefined,
    status: row.status,
    attempt: row.attempt,
    createdAt: row.created_at,
  };
}

function safeParseCard(raw: string) {
  try { return JSON.parse(raw); } catch { return undefined; }
}

export const onRequestGet = onRequest;
export const onRequestPatch = onRequest;
export const onRequestPost = onRequest;
export const onRequestDelete = onRequest;
