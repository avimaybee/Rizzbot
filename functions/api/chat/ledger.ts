import { corsHeadersFor } from "../../lib/cors";
import { checkChatAllowlist, ensureChatSchema, resolveChatDb, utcNowIso } from "../../lib/chatStore";

export interface LedgerEntry {
  id: string;
  text: string;
  label?: string;
  source: "user" | "agent";
}

const MAX_ENTRIES = 40;
const MAX_TEXT = 250;

function sanitizeEntries(raw: unknown): LedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LedgerEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as any;
    if (typeof o.id !== "string" || !o.id) continue;
    if (typeof o.text !== "string") continue;
    const text = o.text.trim();
    if (!text || text.length > MAX_TEXT) continue;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 60) : undefined;
    const source = o.source === "agent" ? "agent" : "user";
    out.push({ id: o.id.slice(0, 64), text, label, source });
  }
  return out.slice(0, MAX_ENTRIES);
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

  if (request.method === "GET") {
    const row = (await db.prepare(`SELECT entries_json, revision, updated_at FROM chat_ledgers WHERE uid=?`).bind(uid).first().catch(() => null)) as any;
    const entries = row ? sanitizeEntries(safeParse(row.entries_json)) : [];
    return new Response(JSON.stringify({ entries, revision: row?.revision ?? 0, cap: MAX_ENTRIES }), { status: 200, headers: cors });
  }

  if (request.method === "PATCH") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }
    const revision = typeof body?.revision === "number" ? body.revision : -1;
    if (revision < 0) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });

    const row = (await db.prepare(`SELECT entries_json, revision FROM chat_ledgers WHERE uid=?`).bind(uid).first().catch(() => null)) as any;
    const currentRevision = row?.revision ?? 0;
    if (revision !== currentRevision) {
      const entries = row ? sanitizeEntries(safeParse(row.entries_json)) : [];
      return new Response(JSON.stringify({ error: "conflict", message: "Memory changed in another chat. Review the latest version before saving.", entries, revision: currentRevision }), { status: 409, headers: cors });
    }
    let entries = row ? sanitizeEntries(safeParse(row.entries_json)) : [];

    const op = body?.op as string | undefined;
    if (op === "clear") {
      entries = [];
    } else if (op === "add") {
      if (entries.length >= MAX_ENTRIES) {
        return new Response(JSON.stringify({ error: "limit", message: "Memory is full. Remove an entry to add another.", entries, revision: currentRevision }), { status: 409, headers: cors });
      }
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text || text.length > MAX_TEXT) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
      const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : undefined;
      entries = [...entries, { id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, text, label, source: "user" as const }];
    } else if (op === "edit") {
      const id = typeof body?.id === "string" ? body.id : "";
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!id || !text || text.length > MAX_TEXT) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
      let found = false;
      entries = entries.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return { ...e, text, label: typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : e.label, source: "user" as const };
      });
      if (!found) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });
    } else if (op === "delete") {
      const id = typeof body?.id === "string" ? body.id : "";
      if (!id) return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
      entries = entries.filter((e) => e.id !== id);
    } else {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }

    const now = utcNowIso();
    const nextRev = currentRevision + 1;
    const json = JSON.stringify(entries);
    try {
      await db.prepare(`INSERT INTO chat_ledgers (uid, entries_json, revision, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET entries_json=excluded.entries_json, revision=excluded.revision, updated_at=excluded.updated_at WHERE chat_ledgers.revision=?`)
        .bind(uid, json, nextRev, now, currentRevision).run();
    } catch {
      // Fallback for older SQLite without upsert-where: conditional update then insert
      const upd: any = await db.prepare(`UPDATE chat_ledgers SET entries_json=?, revision=?, updated_at=? WHERE uid=? AND revision=?`).bind(json, nextRev, now, uid, currentRevision).run().catch(() => null);
      const changed = (upd as any)?.changes ?? (upd as any)?.meta?.changes ?? 0;
      if (!changed) {
        const exists = await db.prepare(`SELECT uid FROM chat_ledgers WHERE uid=?`).bind(uid).first().catch(() => null);
        if (!exists) {
          await db.prepare(`INSERT INTO chat_ledgers (uid, entries_json, revision, updated_at) VALUES (?, ?, ?, ?)`).bind(uid, json, nextRev, now).run().catch(() => {});
        } else {
          const latest = (await db.prepare(`SELECT entries_json, revision FROM chat_ledgers WHERE uid=?`).bind(uid).first().catch(() => null)) as any;
          return new Response(JSON.stringify({ error: "conflict", message: "Memory changed in another chat. Review the latest version before saving.", entries: sanitizeEntries(safeParse(latest?.entries_json)), revision: latest?.revision ?? currentRevision }), { status: 409, headers: cors });
        }
      }
    }
    return new Response(JSON.stringify({ entries, revision: nextRev }), { status: 200, headers: cors });
  }

  return new Response(JSON.stringify({ error: "invalid_input" }), { status: 405, headers: cors });
}

function safeParse(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export const onRequestGet = onRequest;
export const onRequestPatch = onRequest;
