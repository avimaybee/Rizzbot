import { corsHeadersFor } from "../../lib/cors";
import { ensureChatSchema, resolveChatDb, utcNowIso } from "../../lib/chatStore";

export type AssistantVibe = "unfiltered" | "balanced" | "gentle";

export interface AppSettingsWire {
  vibe: AssistantVibe;
  autoLearnVoice: boolean;
  autoSaveMemory: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettingsWire = {
  vibe: "unfiltered",
  autoLearnVoice: true,
  autoSaveMemory: true,
  hapticsEnabled: true,
};

function sanitizeSettings(row: any): AppSettingsWire {
  const vibe = row?.vibe === "balanced" || row?.vibe === "gentle" ? row.vibe : "unfiltered";
  return {
    vibe,
    autoLearnVoice: row?.auto_learn_voice === 0 ? false : true,
    autoSaveMemory: row?.auto_save_memory === 0 ? false : true,
    hapticsEnabled: row?.haptics_enabled === 0 ? false : true,
  };
}

export async function loadUserSettings(db: any, uid: string): Promise<AppSettingsWire> {
  if (!db || !uid) return DEFAULT_SETTINGS;
  try {
    const row = await db
      .prepare(`SELECT vibe, auto_learn_voice, auto_save_memory, haptics_enabled FROM user_settings WHERE uid=?`)
      .bind(uid)
      .first();
    return row ? sanitizeSettings(row) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const cors = { ...corsHeadersFor(request), "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const uid = data?.user?.uid as string | undefined;
  if (!uid) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  const db = resolveChatDb(env);
  if (!db) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: cors });
  await ensureChatSchema(db);

  if (request.method === "GET") {
    const settings = await loadUserSettings(db, uid);
    let memoryCount = 0;
    let threadCount = 0;
    try {
      const ledgerRow = (await db.prepare(`SELECT entries_json FROM chat_ledgers WHERE uid=?`).bind(uid).first()) as any;
      if (ledgerRow?.entries_json) {
        const parsed = JSON.parse(ledgerRow.entries_json);
        if (Array.isArray(parsed)) memoryCount = parsed.length;
      }
    } catch { /* ignore */ }
    try {
      const tRow = (await db.prepare(`SELECT COUNT(*) AS cnt FROM chat_threads WHERE uid=? AND deleting_at IS NULL`).bind(uid).first()) as any;
      threadCount = typeof tRow?.cnt === "number" ? tRow.cnt : Number(tRow?.cnt) || 0;
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ settings, stats: { memoryCount, memoryCap: 40, threadCount } }), {
      status: 200,
      headers: cors,
    });
  }

  if (request.method === "PUT") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
    }
    const cur = await loadUserSettings(db, uid);
    const next: AppSettingsWire = {
      vibe: body?.vibe === "balanced" || body?.vibe === "gentle" || body?.vibe === "unfiltered" ? body.vibe : cur.vibe,
      autoLearnVoice: typeof body?.autoLearnVoice === "boolean" ? body.autoLearnVoice : cur.autoLearnVoice,
      autoSaveMemory: typeof body?.autoSaveMemory === "boolean" ? body.autoSaveMemory : cur.autoSaveMemory,
      hapticsEnabled: typeof body?.hapticsEnabled === "boolean" ? body.hapticsEnabled : cur.hapticsEnabled,
    };
    const now = utcNowIso();
    await db
      .prepare(
        `INSERT INTO user_settings (uid, vibe, auto_learn_voice, auto_save_memory, haptics_enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(uid) DO UPDATE SET
           vibe=excluded.vibe,
           auto_learn_voice=excluded.auto_learn_voice,
           auto_save_memory=excluded.auto_save_memory,
           haptics_enabled=excluded.haptics_enabled,
           updated_at=excluded.updated_at`
      )
      .bind(uid, next.vibe, next.autoLearnVoice ? 1 : 0, next.autoSaveMemory ? 1 : 0, next.hapticsEnabled ? 1 : 0, now)
      .run();
    return new Response(JSON.stringify({ settings: next }), { status: 200, headers: cors });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "chats";

    if (scope === "voice_samples") {
      try {
        const uRow = (await db.prepare(`SELECT id FROM users WHERE anon_id=?`).bind(uid).first()) as any;
        if (uRow?.id) {
          await db
            .prepare(`UPDATE style_profiles SET learned_samples='[]', cadence_notes='', sample_count=0, updated_at=? WHERE user_id=?`)
            .bind(utcNowIso(), uRow.id)
            .run();
        }
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    }

    if (scope === "chats") {
      const now = utcNowIso();
      try {
        await db.prepare(`UPDATE chat_threads SET deleting_at=? WHERE uid=?`).bind(now, uid).run();
      } catch { /* ignore */ }
      const bucket = (env as any).RIZZBOT_MEDIA;
      const prefix = `chat/${uid}/`;
      if (bucket) {
        try {
          let cursor: string | undefined = undefined;
          for (let i = 0; i < 25; i++) {
            const listed: any = await bucket.list({ prefix, limit: 500, cursor });
            const objs: any[] = listed?.objects || [];
            if (objs.length) {
              await Promise.all(objs.map((o: any) => bucket.delete(o.key).catch(() => {})));
            }
            if (listed?.truncated && listed?.cursor) cursor = listed.cursor;
            else break;
          }
        } catch {
          return new Response(JSON.stringify({ error: "unavailable", message: "Couldn’t delete all media. Try again." }), { status: 503, headers: cors });
        }
      }
      await db.batch([
        db.prepare(`DELETE FROM chat_turns WHERE uid=?`).bind(uid),
        db.prepare(`DELETE FROM chat_threads WHERE uid=?`).bind(uid),
      ]);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: cors });
  }

  return new Response(JSON.stringify({ error: "invalid_input" }), { status: 405, headers: cors });
}

export const onRequestGet = onRequest;
export const onRequestPut = onRequest;
export const onRequestDelete = onRequest;
