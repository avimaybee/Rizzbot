import { getAuthHeaders } from "./authHeaders";
import type { ChatRef } from "./chatApi";

export interface SendTurnInput {
  mode: "regular" | "incognito";
  threadId?: string;
  turnId?: string;
  text: string;
  attachmentKeys?: string[];
  ref?: ChatRef;
  action?: "draft" | "refine";
  // incognito-only
  images?: Array<{ data: string; mimeType: string }>;
  priorTurns?: Array<{ role: "user" | "assistant"; text: string }>;
  sessionId?: string;
}

export interface StreamCallbacks {
  onAccepted?: (turnId: string) => void;
  onStatus?: (code: string, message: string) => void;
  onDelta?: (text: string) => void;
  onDone?: (turn: any) => void;
  onError?: (code: string, message: string) => void;
  signal?: AbortSignal;
}

/** NDJSON adapter: handles chunk-split UTF-8, multiple events per chunk, final line. */
export async function sendChatTurn(input: SendTurnInput, cb: StreamCallbacks): Promise<void> {
  const headers = await getAuthHeaders();
  const body: any =
    input.mode === "incognito"
      ? {
          mode: "incognito",
          text: input.text,
          images: input.images || [],
          priorTurns: input.priorTurns || [],
          sessionId: input.sessionId,
          ref: input.ref,
          action: input.action,
        }
      : {
          mode: "regular",
          threadId: input.threadId,
          turnId: input.turnId,
          text: input.text,
          attachmentKeys: input.attachmentKeys || [],
          ref: input.ref,
          action: input.action,
        };

  const res = await fetch(`/api/opencode/thread`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: cb.signal,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !res.body || !contentType.includes("ndjson")) {
    let code = "upstream";
    let message = "Couldn’t finish that reply.";
    try {
      const data: any = await res.json();
      code = data?.error || code;
      message = data?.message || message;
    } catch { /* keep defaults */ }
    if (res.status === 429) { code = "allowance"; message = "Chat is at its usage limit. Try again later."; }
    else if (res.status === 409) { code = dataCode(code); message = messageFor(code); }
    else if (res.status === 401) { code = "unauthorized"; message = "Sign in to use Chat."; }
    else if (res.status === 404) { code = "not_found"; message = "This chat isn’t available."; }
    cb.onError?.(code, message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let evt: any;
    try { evt = JSON.parse(line); } catch { return; }
    if (evt.type === "accepted") cb.onAccepted?.(evt.turnId || "");
    else if (evt.type === "status") cb.onStatus?.(evt.code || "thinking", evt.message || statusCopy(evt.code));
    else if (evt.type === "delta" && typeof evt.text === "string") cb.onDelta?.(evt.text);
    else if (evt.type === "done") cb.onDone?.(evt.turn);
    else if (evt.type === "error") cb.onError?.(evt.code || "upstream", evt.message || "Couldn’t finish that reply.");
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      handleLine(line);
      idx = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) handleLine(buffer);
}

function dataCode(code: string): string {
  return code === "active" ? "active" : "conflict";
}

function messageFor(code: string): string {
  if (code === "active") return "Still working on your last message…";
  return "Couldn’t send your message. Try again.";
}

function statusCopy(code: string): string {
  if (code === "drafting") return "Drafting replies…";
  if (code === "refining") return "Reworking that line…";
  if (code === "reading") return "Reading your screenshots…";
  return "Thinking…";
}

export async function reconcileTurn(threadId: string, turnId: string): Promise<any | null> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}?turnId=${encodeURIComponent(turnId)}`, { headers });
  if (!res.ok) return null;
  const data: any = await res.json().catch(() => null);
  return data?.turn || null;
}

export function parseNdjsonLines(raw: string): any[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}
