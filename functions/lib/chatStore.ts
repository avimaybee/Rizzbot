import { ensureAppSchema } from "../api/schema";

export function resolveChatDb(env: any): any {
  return (
    env.RIZZBOT_DATA ||
    env.RIZZBOT ||
    env.RIZZBOT_DB ||
    env.RIZZBOT_D1 ||
    env.RIZZBOT_DATASET ||
    (env as any)["rizzbot data"]
  );
}

export function utcNowIso(): string {
  return new Date().toISOString();
}

export async function ensureChatSchema(db: any): Promise<void> {
  await ensureAppSchema(db);
}

export function isChatOwner(env: { CHAT_OWNER_UID?: string }, uid: string): boolean {
  return Boolean(uid) && env.CHAT_OWNER_UID?.trim() === uid;
}

export function checkChatAllowlist(env: { CHAT_OWNER_UID?: string; CHAT_ALLOWLIST?: string }, uid: string): boolean {
  if (!uid) return false;
  if (isChatOwner(env, uid)) return true;
  return (env.CHAT_ALLOWLIST ?? "").split(",").some((entry) => entry.trim() === uid);
}

export function isUuidLike(v: unknown): boolean {
  return typeof v === "string" && v.trim().length >= 8 && v.trim().length <= 128;
}

export function trimTitle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length < 1 || t.length > 56) return null;
  return t;
}

export function deriveTitleFromText(text: string): string {
  const first = (text || "").split("\n")[0].trim().slice(0, 56).trim();
  return first || "New chat";
}

export interface ChatThreadRow {
  id: string;
  uid: string;
  title: string;
  context_note: string;
  deleting_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatTurnRow {
  id: string;
  thread_id: string;
  uid: string;
  user_text: string;
  attachments: string;
  ref_source_turn_id: string | null;
  ref_tone: string | null;
  ref_option_index: number | null;
  ref_bubble_index: number | null;
  assistant_text: string;
  card_json: string | null;
  status: string;
  attempt: number;
  started_at: string;
  created_at: string;
}

export function parseAttachments(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string") as string[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.filter((x) => typeof x === "string");
    } catch { return []; }
    return [];
  }
  return [];
}

/** Stable fingerprint for duplicate/conflict detection (same input → same string). */
export function fingerprintTurnInput(input: { text: string; attachmentKeys: string[]; ref?: unknown }): string {
  return JSON.stringify(input ?? null);
}

export type ExistingTurnClass =
  | "replay_complete"
  | "active_same"
  | "conflict_resend"
  | "retry_latest"
  | "conflict_old";

/**
 * Pure classifier for the duplicate/stale turn branch (release-gate regression lock).
 * - complete → replay the saved result
 * - pending + same input → active (generation in progress)
 * - pending + different input → conflict (reused ID with different content)
 * - failed/expired + latest → retry with same ID and new attempt
 * - failed/expired + older → conflict (send as new draft)
 */
export function classifyExistingTurn(args: {
  status: string;
  sameInput: boolean;
  isLatestFailed: boolean;
}): ExistingTurnClass {
  if (args.status === "complete") return "replay_complete";
  if (args.status === "pending") return args.sameInput ? "active_same" : "conflict_resend";
  if (args.status === "failed" || args.status === "expired") {
    return args.isLatestFailed ? "retry_latest" : "conflict_old";
  }
  return "conflict_old";
}

export function notFound(): Response {
  return new Response(JSON.stringify({ error: "not_found", message: "This chat isn’t available." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export async function expireStalePending(db: any, threadId: string, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - 105_000).toISOString();
  try {
    await db
      .prepare(`UPDATE chat_turns SET status='expired' WHERE thread_id=? AND status='pending' AND started_at < ?`)
      .bind(threadId, cutoff)
      .run();
  } catch { /* ignore */ }
}

export async function expireStalePendingForUser(db: any, uid: string, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - 105_000).toISOString();
  try {
    await db
      .prepare(`UPDATE chat_turns SET status='expired' WHERE uid=? AND status='pending' AND started_at < ?`)
      .bind(uid, cutoff)
      .run();
  } catch { /* ignore */ }
}
