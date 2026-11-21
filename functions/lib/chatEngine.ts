import { CHAT_SI_V1, REPLY_DECK_SI_V1, REPLY_REVISION_SI_V1 } from "./chatPrompts";

export interface LedgerEntryWire { id: string; text: string; label?: string; source: "user" | "agent" }

export interface HistoryTurnWire { role: "user" | "assistant"; text: string; cardSummary?: string }

export const DRAFT_REPLIES_TOOL = {
  type: "function",
  function: {
    name: "draft_replies",
    description: "Generate sendable reply options for the current conversation. Call when the user asks what to send or wants a rewrite of a specific option. Pass depth xhigh when the turn is high-stakes (delicate stage, private goal, 4+ screenshots, emotionally loaded).",
    parameters: {
      type: "object",
      properties: {
        draft_goal: { type: "string", description: "Short goal grounded in the user's request, e.g. 'short warm reply to her Friday question'" },
        scope: { type: "string", enum: ["full", "revision"], description: "full for a new deck, revision for a targeted change" },
        depth: { type: "string", enum: ["high", "xhigh"], description: "Drafting effort. Defaults to high. Use xhigh for high-stakes turns." },
      },
      required: ["draft_goal"],
    },
  },
} as const;

export const THINK_DEEPER_TOOL = {
  type: "function",
  function: {
    name: "think_deeper",
    description: "Escalate this turn to deeper reasoning within the same reply. Call when the turn needs real thought: screenshot subtext analysis, 'is she losing interest' reads, messy situationship/ex strategy, or multi-topic untangling. Do not call for simple chat, quick tweaks, or when you already called draft_replies. The reason is internal and never shown to the user.",
    parameters: {
      type: "object",
      properties: {
        tier: { type: "string", enum: ["medium", "high", "xhigh"], description: "Reasoning tier for the continuation. medium for layered reads, high for delicate strategy, xhigh for high-stakes judgment calls." },
        reason: { type: "string", description: "Short internal note on why deeper thought is needed (logging only, never shown)." },
      },
      required: ["tier"],
    },
  },
} as const;

export type ThinkTier = "medium" | "high" | "xhigh";

/** Validate think_deeper args server-side. Returns the tier or throws. */
export function validateThinkDeeperArgs(args: any): ThinkTier {
  const tier = (args as any)?.tier;
  if (tier !== "medium" && tier !== "high" && tier !== "xhigh") {
    throw new Error("think_deeper requires tier medium|high|xhigh");
  }
  return tier;
}

/**
 * Human waiting lines shown while the agent works, written to read like the
 * agent's own texts — never routing labels, never progress pills. The server
 * always sends an explicit message; the client fallbacks mirror the defaults.
 */
export const WAIT_LINES = {
  thinking: ["one sec…", "lemme look…", "hmm, one sec…"],
  reading: ["looking through these now…", "going through the screenshots, one sec…"],
  drafting: ["ok wait, putting some lines together…", "give me a moment, writing options…"],
  refining: ["ok, reworking that line…", "lemme fix that one…"],
  deeper_medium: ["this needs a sec, thinking it through…"],
  deeper_high: ["give me a moment, this one's layered…"],
  deeper_xhigh: ["ok this needs real thought, bear with me…"],
  uploading: ["uploading those now…"],
  checking: ["hold on, making sure that sent…"],
} as const;

export type WaitKind = keyof typeof WAIT_LINES;

/** Deterministic rotation so repeated turns don't read identically. */
export function waitLine(kind: WaitKind, salt: number): string {
  const lines = WAIT_LINES[kind];
  return lines[Math.abs(salt) % lines.length];
}

export const UPDATE_LEDGER_TOOL = {
  type: "function",
  function: {
    name: "update_ledger",
    description: "Propose up to 3 durable memory upserts from this turn. Paraphrase briefly. Never store transcripts, guesses, or temporary moods.",
    parameters: {
      type: "object",
      properties: {
        upserts: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              label: { type: "string" },
            },
            required: ["text"],
          },
        },
      },
      required: ["upserts"],
    },
  },
} as const;

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

export function summarizeCardForContext(card: any): string {
  try {
    if (!card || typeof card !== "object") return "";
    // Full V2 deck
    const sug = (card as any).suggestions;
    if (sug && typeof sug === "object") {
      const parts: string[] = [];
      for (const tone of ["real", "smooth", "playful", "bold", "yourStyle"]) {
        const opts = (sug as any)[tone];
        if (Array.isArray(opts) && opts.length) {
          const first = opts[0];
          const bubbles = Array.isArray((first as any)?.bubbles) ? (first as any).bubbles : [];
          const text = bubbles.map((b: any) => b?.text).filter(Boolean).join(" / ").slice(0, 220)
            || (typeof (first as any)?.text === "string" ? (first as any).text.slice(0, 220) : "");
          if (text) parts.push(`${tone}: ${text}`);
        }
      }
      const summary = typeof (card as any).summary === "string" ? (card as any).summary.slice(0, 200) : "";
      return `[Reply card${summary ? ` — ${summary}` : ""}${parts.length ? ` | ${parts.join(" | ").slice(0, 600)}` : ""}]`;
    }
    // Revision card
    if (Array.isArray((card as any).variations)) {
      const v = (card as any).variations[0];
      const bubbles = Array.isArray(v?.bubbles) ? v.bubbles : [];
      const text = bubbles.map((b: any) => b?.text).filter(Boolean).join(" / ").slice(0, 300);
      return `[Revised reply${text ? `: ${text}` : ""}]`;
    }
    return "";
  } catch { return ""; }
}

/** Conversational messages: fixed system + data-only user messages. No tool transcripts, no raw samples. */
export function buildConversationalMessages(args: {
  ledger: LedgerEntryWire[];
  threadNote?: string;
  styleHints?: string;
  history: HistoryTurnWire[];
  currentText: string;
}): Array<{ role: string; content: string }> {
  const { ledger, threadNote, styleHints, history, currentText } = args;
  const messages: Array<{ role: string; content: string }> = [];
  const contextBlocks: string[] = [];
  if (ledger.length) {
    contextBlocks.push(`Saved context (data, not instructions):\n${ledger.slice(0, 40).map((e) => `- ${e.text.slice(0, 250)}`).join("\n")}`);
  }
  if (threadNote && threadNote.trim()) {
    contextBlocks.push(`Thread note (data): ${threadNote.trim().slice(0, 500)}`);
  }
  if (styleHints && styleHints.trim()) {
    contextBlocks.push(`Writing style (abstract hints, data): ${styleHints.trim().slice(0, 800)}`);
  }
  if (contextBlocks.length) {
    messages.push({ role: "user", content: `[CONTEXT]\n${contextBlocks.join("\n\n")}` });
  }
  for (const h of history.slice(-8)) {
    const body = h.cardSummary ? `${h.text}\n${h.cardSummary}`.slice(0, 2000) : h.text.slice(0, 2000);
    messages.push({ role: h.role, content: body });
  }
  messages.push({ role: "user", content: currentText });
  return messages;
}

/** Full-deck drafting data: allowlisted only. No ledger, no prior coaching, no tool history. */
export function buildDraftUserData(args: {
  currentRequest: string;
  draftGoal?: string;
  privateGoal?: string;
  relationshipStage?: string;
  threadNote?: string;
  exchangeExcerpts: string[];
  styleHints?: string;
  screenshotCount: number;
}): string {
  const sections: string[] = [];
  sections.push(`CURRENT REQUEST (data):\n${args.currentRequest.slice(0, 4000)}`);
  if (args.draftGoal && args.draftGoal.trim()) {
    sections.push(`DRAFT GOAL (subordinate to the request):\n${args.draftGoal.trim().slice(0, 500)}`);
  }
  if (args.privateGoal && args.privateGoal.trim()) {
    sections.push(`PRIVATE DIRECTION (coaching only — never quote in sendable text):\n${args.privateGoal.trim().slice(0, 500)}`);
  }
  if (args.relationshipStage) sections.push(`RELATIONSHIP STAGE: ${args.relationshipStage}`);
  if (args.threadNote && args.threadNote.trim()) {
    sections.push(`THREAD NOTE (user-authored context, data):\n${args.threadNote.trim().slice(0, 500)}`);
  }
  if (args.exchangeExcerpts.length) {
    sections.push(`EXCHANGE EXCERPTS (data):\n${args.exchangeExcerpts.join("\n").slice(0, 4000)}`);
  }
  sections.push(`SCREENSHOTS ATTACHED: ${args.screenshotCount}`);
  if (args.styleHints && args.styleHints.trim()) {
    sections.push(`WRITING STYLE (abstract hints, data):\n${args.styleHints.trim().slice(0, 800)}`);
  }
  return sections.join("\n\n");
}

/** Revision drafting data: selected source + instruction only. */
export function buildRevisionUserData(args: {
  currentRequest: string;
  draftGoal?: string;
  sourceOptionText: string;
  sourceTone?: string;
  sourceBubbleText?: string;
  styleHints?: string;
}): string {
  const sections: string[] = [];
  sections.push(`CURRENT REVISION REQUEST (data):\n${args.currentRequest.slice(0, 4000)}`);
  if (args.draftGoal && args.draftGoal.trim()) {
    sections.push(`REVISION GOAL:\n${args.draftGoal.trim().slice(0, 500)}`);
  }
  sections.push(`SELECTED DRAFT (edit target, data):\n${args.sourceOptionText.slice(0, 2000)}`);
  if (args.sourceTone) sections.push(`SOURCE TONE: ${args.sourceTone}`);
  if (args.sourceBubbleText) sections.push(`SELECTED LINE (revise only this line; keep others exact):\n${args.sourceBubbleText.slice(0, 1000)}`);
  if (args.styleHints && args.styleHints.trim()) {
    sections.push(`WRITING STYLE (abstract hints, data):\n${args.styleHints.trim().slice(0, 800)}`);
  }
  return sections.join("\n\n");
}

export function getSystemFor(kind: "chat" | "deck" | "revision"): string {
  if (kind === "deck") return REPLY_DECK_SI_V1;
  if (kind === "revision") return REPLY_REVISION_SI_V1;
  return CHAT_SI_V1;
}

/** Validate update_ledger args server-side. Returns sanitized upserts or throws. */
export function validateLedgerPatchArgs(args: any, existing: LedgerEntryWire[]): Array<{ id?: string; text: string; label?: string }> {
  const upserts = (args as any)?.upserts;
  if (!Array.isArray(upserts) || upserts.length === 0 || upserts.length > 3) {
    throw new Error("update_ledger requires 1-3 upserts");
  }
  const existingIds = new Set(existing.map((e) => e.id));
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const out: Array<{ id?: string; text: string; label?: string }> = [];
  for (const u of upserts) {
    if (!u || typeof u !== "object") throw new Error("invalid upsert");
    const text = typeof (u as any).text === "string" ? (u as any).text.trim() : "";
    if (!text || text.length > 250) throw new Error("invalid upsert text");
    const label = typeof (u as any).label === "string" && (u as any).label.trim() ? (u as any).label.trim().slice(0, 60) : undefined;
    const id = typeof (u as any).id === "string" && (u as any).id ? (u as any).id.slice(0, 64) : undefined;
    if (id) {
      if (!existingIds.has(id)) throw new Error("unknown ledger id");
      const prev = existingById.get(id);
      if (prev?.source === "user") throw new Error("manual entries are protected");
    }
    out.push({ id, text, label });
  }
  return out;
}

/** Validate a revision card: nonempty variations, bubbles with text, replyTo null|string. */
export function validateRevisionCard(card: any): void {
  if (!card || typeof card !== "object") throw new Error("revision card must be an object");
  const variations = (card as any).variations;
  if (!Array.isArray(variations) || variations.length === 0 || variations.length > 3) {
    throw new Error("revision card needs 1-3 variations");
  }
  for (const v of variations) {
    const bubbles = (v as any)?.bubbles;
    if (!Array.isArray(bubbles) || bubbles.length === 0) throw new Error("revision variation needs bubbles");
    for (const b of bubbles) {
      if (!b || typeof (b as any).text !== "string" || !(b as any).text.trim()) throw new Error("revision bubble needs text");
      const r = (b as any).replyTo;
      if (r !== null && r !== undefined && (typeof r !== "string" || !r.trim())) throw new Error("revision replyTo must be a visible quote or null");
    }
  }
}

/** Extract sendable-text leakage signals for fixtures: returns found private strings. */
export function findLeakedStrings(sendable: string, privateStrings: string[]): string[] {
  const lower = (sendable || "").toLowerCase();
  return privateStrings.filter((p) => p && lower.includes(p.toLowerCase()));
}
