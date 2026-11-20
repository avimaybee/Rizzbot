/** Best-effort model-call telemetry. Never throws, never blocks the response. */

export interface ModelCallLog {
  endpoint: string;
  model: string;
  latencyMs: number;
  ok: boolean;
  error?: string;
  uid?: string;
}

async function ensureTable(db: any): Promise<void> {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS model_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          endpoint TEXT,
          model TEXT,
          latency_ms INTEGER,
          ok INTEGER,
          error TEXT,
          uid TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      )
      .run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_model_calls_created ON model_calls(created_at DESC)`).run();
  } catch {
    // best effort only
  }
}

export async function logModelCall(db: any, log: ModelCallLog): Promise<void> {
  if (!db) return;
  try {
    await ensureTable(db);
    await db
      .prepare(
        `INSERT INTO model_calls (endpoint, model, latency_ms, ok, error, uid) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(log.endpoint, log.model, log.latencyMs, log.ok ? 1 : 0, log.error || null, log.uid || null)
      .run();
    // Retention: keep last ~2000 rows
    await db
      .prepare(`DELETE FROM model_calls WHERE id NOT IN (SELECT id FROM model_calls ORDER BY id DESC LIMIT 2000)`)
      .run();
  } catch {
    // telemetry must never break the request
  }
}

/** Fire-and-forget wrapper for Pages Functions `context.waitUntil`. Falls back to awaiting. */
export function telemetry(context: any, db: any, log: ModelCallLog): void {
  try {
    const p = logModelCall(db, log);
    if (context && typeof context.waitUntil === "function") context.waitUntil(p);
    else void p.catch(() => {});
  } catch {
    // ignore
  }
}
