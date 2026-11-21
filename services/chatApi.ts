import { getAuthHeaders } from "./authHeaders";

export interface ChatThreadSummary {
  id: string;
  title: string;
  context_note?: string;
  title_manual?: number;
  created_at: string;
  updated_at: string;
}

export interface ChatRef {
  sourceTurnId: string;
  tone?: string;
  optionIndex?: number;
  bubbleIndex?: number;
}

export interface ReplyQuote {
  author: string;
  text: string;
  turnId?: string;
  tone?: string;
  optionIndex?: number;
  bubbleIndex?: number;
}

export interface ChatTurnWire {
  action?: "draft" | "refine";
  id: string;
  threadId?: string;
  userText: string;
  attachments: string[];
  ref?: ChatRef;
  replyQuote?: ReplyQuote;
  assistantText: string;
  card?: any;
  status: string;
  attempt?: number;
  createdAt?: string;
}

export interface AppSettingsWire {
  vibe: "unfiltered" | "balanced" | "gentle";
  autoLearnVoice: boolean;
  autoSaveMemory: boolean;
  hapticsEnabled: boolean;
  memoryCount: number;
  memoryCap: number;
  threadCount: number;
}

async function authed(path: string, init?: RequestInit): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(init?.headers || {}),
    },
  });
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newThreadId(): string { return newUuid(); }
export function newTurnId(): string { return newUuid(); }

export async function listThreads(cursor?: string | null): Promise<{ threads: ChatThreadSummary[]; nextCursor: string | null }> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await authed(`/api/chat/threads${q}`);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function createThread(input: { id: string; title: string; initialText?: string }): Promise<{ thread: ChatThreadSummary }> {
  const res = await authed(`/api/chat/threads`, { method: "POST", body: JSON.stringify(input) });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function getThread(threadId: string, opts?: { cursor?: string | null; turnId?: string }): Promise<{ thread: ChatThreadSummary; turns?: ChatTurnWire[]; turn?: ChatTurnWire; nextCursor?: string | null }> {
  const params = new URLSearchParams();
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.turnId) params.set("turnId", opts.turnId);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}${q}`);
  if (res.status === 404) throw new Error("not_found");
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function renameThread(threadId: string, title: string): Promise<{ thread: ChatThreadSummary }> {
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}`, { method: "PATCH", body: JSON.stringify({ title }) });
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function updateThreadNote(threadId: string, contextNote: string): Promise<{ thread: ChatThreadSummary }> {
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}`, { method: "PATCH", body: JSON.stringify({ context_note: contextNote }) });
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function abortTurn(threadId: string, turnId: string): Promise<void> {
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: "POST",
    body: JSON.stringify({ action: "abort_pending", turnId }),
  });
  if (!res.ok && res.status !== 404) throw new Error("unavailable");
}

export async function rewindThread(
  threadId: string,
  turnId: string,
  opts?: { keepAnchorMedia?: boolean }
): Promise<{ deletedTurnIds?: string[] }> {
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: "POST",
    body: JSON.stringify({ action: "rewind_to", turnId, keepAnchorMedia: Boolean(opts?.keepAnchorMedia) }),
  });
  if (res.status === 404) throw new Error("not_found");
  if (res.status === 409) throw new Error("active");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function getAppSettings(): Promise<AppSettingsWire> {
  const res = await authed(`/api/chat/settings`);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function updateAppSettings(
  patch: Partial<Pick<AppSettingsWire, "vibe" | "autoLearnVoice" | "autoSaveMemory" | "hapticsEnabled">>
): Promise<AppSettingsWire> {
  const res = await authed(`/api/chat/settings`, { method: "PUT", body: JSON.stringify(patch) });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function deleteAllChats(): Promise<void> {
  const res = await authed(`/api/chat/settings?scope=chats`, { method: "DELETE" });
  if (!res.ok) throw new Error("unavailable");
}

export async function clearVoiceSamples(): Promise<void> {
  const res = await authed(`/api/chat/settings?scope=voice_samples`, { method: "DELETE" });
  if (!res.ok) throw new Error("unavailable");
}

export async function deleteThread(threadId: string): Promise<void> {
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("unavailable");
}

export async function uploadChatImages(threadId: string, turnId: string, images: Array<{ id?: string; data: string; mimeType: string }>): Promise<string[]> {
  const res = await authed(`/api/chat/threads/${encodeURIComponent(threadId)}/media`, {
    method: "POST",
    body: JSON.stringify({ turnId, images }),
  });
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(err?.error || "unavailable");
  }
  const data = (await res.json()) as { keys?: string[] };
  return data.keys || [];
}

export interface LedgerEntry { id: string; text: string; label?: string; source: "user" | "agent" }

export async function getLedger(): Promise<{ entries: LedgerEntry[]; revision: number; cap: number }> {
  const res = await authed(`/api/chat/ledger`);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export async function patchLedger(body: { revision: number; op: "add" | "edit" | "delete" | "clear"; id?: string; text?: string; label?: string }): Promise<{ entries: LedgerEntry[]; revision: number }> {
  const res = await authed(`/api/chat/ledger`, { method: "PATCH", body: JSON.stringify(body) });
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error("conflict");
    err.data = data;
    throw err;
  }
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export function chatErrorCopy(code: string): string {
  switch (code) {
    case "allowance": return "Chat is at its usage limit. Try again later.";
    case "active": return "Still working on your last message…";
    case "conflict": return "Couldn’t send your message. Try again.";
    case "not_found": return "This chat isn’t available.";
    case "invalid_input": return "Couldn’t send your message. Try again.";
    case "unauthorized": return "Sign in to use Chat.";
    case "aborted": return "Stopped.";
    default: return "Couldn’t finish that reply.";
  }
}
