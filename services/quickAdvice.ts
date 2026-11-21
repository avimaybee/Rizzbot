import { QuickAdviceResponse, QuickReplyBubble, QuickReplyStyle, SuggestionOption } from "../types";

export const FALLBACK_PRO_TIP = "ngl couldn't read that one properly, try again";

export const QUICK_STYLES: readonly QuickReplyStyle[] = [
  'real',
  'smooth',
  'playful',
  'bold',
  'yourStyle',
] as const;

/**
 * Normalize a raw model payload into a well-formed QuickAdviceResponse.
 * Behavior preserved from legacy quick advice assembly.
 * Extended to also synthesize V2 bubble sequences and summary fields.
 */
export function normalizeQuickAdvice(parsed: any): QuickAdviceResponse {
  const normalize = (list: any): SuggestionOption[] =>
    Array.isArray(list) ? list.filter((o: any) => o && Array.isArray(o.replies) && o.replies.length > 0) : [];
  const base: QuickAdviceResponse = {
    ...parsed,
    vibeCheck: parsed.vibeCheck || {
      theirEnergy: 'neutral',
      interestLevel: 50,
      redFlags: [],
      greenFlags: []
    },
    suggestions: {
      smooth: normalize(parsed.suggestions?.smooth),
      bold: normalize(parsed.suggestions?.bold).length > 0
        ? normalize(parsed.suggestions?.bold)
        : normalize((parsed.suggestions as any)?.roast), // legacy roast data folds into bold
      witty: normalize(parsed.suggestions?.witty),
      authentic: normalize(parsed.suggestions?.authentic),
      yourStyle: normalize(parsed.suggestions?.yourStyle),
      wait: parsed.suggestions?.wait ?? null,
      real: normalize((parsed.suggestions as any)?.real),
      playful: normalize((parsed.suggestions as any)?.playful),
    },
    proTip:
      parsed.proTip ||
      (typeof (parsed as any)?.summary === 'string' && (parsed as any).summary.trim()
        ? (parsed as any).summary.trim()
        : typeof (parsed as any)?.tacticalSummary === 'string' && (parsed as any).tacticalSummary.trim()
        ? (parsed as any).tacticalSummary.trim()
        : FALLBACK_PRO_TIP),
    recommendedAction:
      parsed.recommendedAction || ((parsed as any)?.shouldWait === true ? 'WAIT' : 'MATCH'),
    degraded: parsed?.degraded === true,
  };
  // V2 friend-summary passthrough
  if (typeof (parsed as any)?.summary === 'string' && (parsed as any).summary.trim()) {
    base.summary = (parsed as any).summary.trim();
  } else if (typeof (parsed as any)?.tacticalSummary === 'string' && (parsed as any).tacticalSummary.trim()) {
    base.summary = (parsed as any).tacticalSummary.trim();
  }
  if (typeof (parsed as any)?.shouldWait === 'boolean') base.shouldWait = (parsed as any).shouldWait;
  if (typeof (parsed as any)?.modelUsed === 'string') base.modelUsed = (parsed as any).modelUsed;
  if (typeof (parsed as any)?.tacticalSummary === 'string') base.tacticalSummary = (parsed as any).tacticalSummary;
  if (Array.isArray((parsed as any)?.extractedUnrepliedMessages)) {
    base.extractedUnrepliedMessages = (parsed as any).extractedUnrepliedMessages.filter((m: any) => typeof m === 'string' && m.trim()).map((m: string) => m.trim());
  }
  return base;
}

function bubblesFromReplies(replies: Array<{ originalMessage?: string; reply?: string }>): QuickReplyBubble[] {
  const out: QuickReplyBubble[] = [];
  for (const r of replies) {
    if (!r || typeof r.reply !== 'string' || !r.reply.trim()) continue;
    out.push({
      replyTo: typeof r.originalMessage === 'string' && r.originalMessage.trim() ? r.originalMessage.trim() : null,
      text: r.reply.trim(),
    });
  }
  return out;
}

function ensureBubbles(option: any): SuggestionOption {
  if (!option || typeof option !== 'object') return option;
  if (Array.isArray(option.bubbles) && option.bubbles.length > 0) return option as SuggestionOption;
  // Synthesize bubbles from V1 replies[] or legacy text
  if (Array.isArray(option.replies) && option.replies.length > 0) {
    return { ...option, bubbles: bubblesFromReplies(option.replies) };
  }
  if (typeof option.text === 'string' && option.text.trim()) {
    return { ...option, replies: option.replies ?? [], bubbles: [{ replyTo: null, text: option.text.trim() }] };
  }
  return option as SuggestionOption;
}

/**
 * Build the degraded fallback response returned when analysis fails.
 */
export function buildQuickFallback(): QuickAdviceResponse {
  const fallbackOption = {
    replies: [{ originalMessage: "their message", reply: "hey" }],
    conversationHook: "whats good",
    bubbles: [{ replyTo: null, text: "hey" }] as QuickReplyBubble[],
  };
  return {
    vibeCheck: { theirEnergy: 'neutral', interestLevel: 50, redFlags: [], greenFlags: [] },
    suggestions: {
      smooth: [fallbackOption, fallbackOption, fallbackOption],
      bold: [fallbackOption, fallbackOption, fallbackOption],
      witty: [fallbackOption, fallbackOption, fallbackOption],
      authentic: [fallbackOption, fallbackOption, fallbackOption],
      yourStyle: [fallbackOption, fallbackOption, fallbackOption],
      real: [fallbackOption, fallbackOption, fallbackOption],
      playful: [fallbackOption, fallbackOption, fallbackOption],
      wait: undefined
    },
    proTip: FALLBACK_PRO_TIP,
    recommendedAction: 'MATCH',
    degraded: true,
    summary: 'Keep it light, match their energy, and leave an easy lane to reply.',
    shouldWait: false,
  };
}

/** V2 fallback alias expected by Plan 010. */
export const FALLBACK_QUICK_ADVICE: QuickAdviceResponse = buildQuickFallback();

/**
 * Detect whether a quick advice response is the degraded fallback.
 */
export function isQuickAdviceDegraded(r: QuickAdviceResponse): boolean {
  if (r.degraded === true) return true;
  if (r.proTip === FALLBACK_PRO_TIP) return true;
  const first = (r.suggestions as any).smooth?.[0]?.replies?.[0]?.reply;
  return first === "hey";
}

/**
 * Build the copy-all payload: replies joined by blank lines, plus hook.
 * Prefers V2 bubbles when replies are empty (e.g. pure bubble options).
 */
export function buildCopyPayload(option: SuggestionOption): string {
  const replies = Array.isArray((option as any).replies)
    ? (option as any).replies.map((r: any) => r?.reply).filter(Boolean).join("\n\n")
    : "";
  const fromBubbles = replies
    ? ""
    : (Array.isArray((option as any).bubbles) ? (option as any).bubbles.map((b: any) => b?.text).filter(Boolean).join("\n\n") : "");
  const body = replies || fromBubbles;
  const hook = (option as any).conversationHook ? `\n\n${(option as any).conversationHook}` : "";
  // If body already equals hook-less text option, avoid double trailing newlines
  if (!body) return (option as any).text ?? "";
  return `${body}${hook}`;
}

// ---------- V2 multi-bubble normalization (Plan 010) ----------

function normalizeBubbles(rawItem: Record<string, unknown>): QuickReplyBubble[] {
  if (Array.isArray(rawItem.bubbles)) {
    const valid = (rawItem.bubbles as unknown[])
      .map((b): QuickReplyBubble | null => {
        if (!b || typeof b !== 'object') return null;
        const bObj = b as Record<string, unknown>;
        const text = typeof bObj.text === 'string' ? bObj.text.trim() : '';
        if (!text) return null;
        const replyTo =
          typeof bObj.replyTo === 'string' && bObj.replyTo.trim().length > 0
            ? bObj.replyTo.trim()
            : null;
        return { replyTo, text };
      })
      .filter((b): b is QuickReplyBubble => b !== null);

    if (valid.length > 0) {
      // No cap: bubble count mirrors how many topics needed replies.
      return valid;
    }
  }

  // Legacy V1 fallback: synthesize a single bubble from `text` or first reply
  if (typeof rawItem.text === 'string' && rawItem.text.trim().length > 0) {
    return [{ replyTo: null, text: (rawItem.text as string).trim() }];
  }
  const replies = (rawItem as any).replies;
  if (Array.isArray(replies) && replies.length > 0) {
    const synth = bubblesFromReplies(replies);
    if (synth.length > 0) return synth;
  }

  return [];
}

function toSuggestionOption(rawItem: Record<string, unknown>): SuggestionOption | null {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const bubbles = normalizeBubbles(rawItem);
  if (bubbles.length === 0) return null;

  const rawReplies = (rawItem as any).replies;
  const replies = Array.isArray(rawReplies) && rawReplies.length > 0
    ? rawReplies.filter((r: any) => r && typeof r.reply === 'string' && r.reply.trim().length > 0)
    : bubbles.map((b) => ({ originalMessage: b.replyTo ?? "", reply: b.text }));

  const joinedText =
    typeof rawItem.text === 'string' && (rawItem.text as string).trim().length > 0
      ? (rawItem.text as string).trim()
      : bubbles.map((b) => b.text).join('\n');

  const conversationHook =
    typeof rawItem.conversationHook === 'string' && (rawItem.conversationHook as string).trim().length > 0
      ? (rawItem.conversationHook as string)
      : bubbles.length > 1 ? "" : "";

    return {
    replies,
    conversationHook,
    bubbles,
    text: joinedText,
    subtext: typeof rawItem.subtext === 'string' ? (rawItem.subtext as string) : undefined,
    isRecommended: Boolean((rawItem as any).isRecommended),
    hookType: typeof (rawItem as any).hookType === 'string' ? (rawItem as any).hookType : undefined,
  };
}

function normalizeStyleList(
  list: unknown,
  fallbackList: SuggestionOption[]
): SuggestionOption[] {
  if (!Array.isArray(list)) return fallbackList;

  const valid = (list as unknown[])
    .map((item) => (item && typeof item === 'object' ? toSuggestionOption(item as Record<string, unknown>) : null))
    .filter((item): item is SuggestionOption => item !== null);

  return valid.length > 0 ? valid : fallbackList;
}

/**
 * Normalize both V2 multi-bubble payloads and legacy V1 single-text payloads
 * into a unified QuickAdviceResponse where every option carries bubbles.
 */
export function normalizeQuickAdviceResponse(
  raw: Partial<QuickAdviceResponse> | null | undefined,
  fallback: QuickAdviceResponse = FALLBACK_QUICK_ADVICE
): QuickAdviceResponse {
  const normalizedV1 = normalizeQuickAdvice((raw ?? {}) as any);
  const safe = (raw ?? {}) as Partial<QuickAdviceResponse> & Record<string, unknown>;
  const rawSuggestions = (safe.suggestions ?? {}) as Partial<QuickAdviceResponse['suggestions']> & Record<string, unknown>;

  const extractedUnrepliedMessages = Array.isArray(safe.extractedUnrepliedMessages)
    ? safe.extractedUnrepliedMessages
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim())
    : (normalizedV1.extractedUnrepliedMessages ?? fallback.extractedUnrepliedMessages ?? []);

  const summary =
    typeof safe.summary === 'string' && safe.summary.trim().length > 0
      ? safe.summary.trim()
      : typeof (safe as any).tacticalSummary === 'string' && (safe as any).tacticalSummary.trim().length > 0
      ? (safe as any).tacticalSummary.trim()
      : fallback.summary ?? normalizedV1.summary ?? 'Keep it light, match their energy, and leave an easy lane to reply.';

  return {
    ...normalizedV1,
    ...safe,
    extractedUnrepliedMessages,
    summary,
    proTip:
      typeof safe.proTip === 'string' && safe.proTip.trim().length > 0
        ? safe.proTip.trim()
        : typeof safe.summary === 'string' && safe.summary.trim().length > 0
        ? safe.summary.trim()
        : typeof (safe as any).tacticalSummary === 'string' && (safe as any).tacticalSummary.trim().length > 0
        ? (safe as any).tacticalSummary.trim()
        : normalizedV1.proTip,
    tacticalSummary:
      typeof (safe as any).tacticalSummary === 'string' && (safe as any).tacticalSummary.trim().length > 0
        ? (safe as any).tacticalSummary.trim()
        : summary,
    shouldWait: typeof safe.shouldWait === 'boolean' ? safe.shouldWait : (normalizedV1.shouldWait ?? fallback.shouldWait ?? false),
    modelUsed: typeof (safe as any).modelUsed === 'string' ? (safe as any).modelUsed : (normalizedV1 as any).modelUsed,
    greenFlags: Array.isArray((safe as any).greenFlags) ? (safe as any).greenFlags : normalizedV1.vibeCheck.greenFlags,
    redFlags: Array.isArray((safe as any).redFlags) ? (safe as any).redFlags : normalizedV1.vibeCheck.redFlags,
    suggestions: (() => {
      const s = {
        ...normalizedV1.suggestions,
        real: normalizeStyleList((rawSuggestions as any).real, fallback.suggestions.real ?? fallback.suggestions.smooth),
        smooth: normalizeStyleList((rawSuggestions as any).smooth, fallback.suggestions.smooth),
        playful: normalizeStyleList((rawSuggestions as any).playful, fallback.suggestions.playful ?? fallback.suggestions.witty),
        bold: normalizeStyleList((rawSuggestions as any).bold, fallback.suggestions.bold),
        witty: normalizeStyleList((rawSuggestions as any).witty, fallback.suggestions.witty),
        authentic: normalizeStyleList((rawSuggestions as any).authentic, fallback.suggestions.authentic),
        yourStyle: normalizeStyleList((rawSuggestions as any).yourStyle, fallback.suggestions.yourStyle),
        wait: (normalizedV1.suggestions as any).wait ?? (fallback.suggestions as any).wait ?? null,
      } as QuickAdviceResponse['suggestions'];
      // Bridge V2 <-> V1 tone names so the pre-012 UI (witty/authentic) and
      // V2 UI (real/playful) both render without empty tabs.
      const isFallbackList = (list: SuggestionOption[], fb: SuggestionOption[]) => list === fb;
      if (s.playful.length > 0 && !isFallbackList(s.playful, fallback.suggestions.playful ?? fallback.suggestions.witty) && (s.witty === fallback.suggestions.witty || s.witty.length === 0)) {
        s.witty = s.playful;
      } else if (s.witty.length > 0 && !isFallbackList(s.witty, fallback.suggestions.witty) && (s.playful === (fallback.suggestions.playful ?? fallback.suggestions.witty) || s.playful.length === 0)) {
        s.playful = s.witty;
      }
      if (s.real.length > 0 && !isFallbackList(s.real, fallback.suggestions.real ?? fallback.suggestions.smooth) && (s.authentic === fallback.suggestions.authentic || s.authentic.length === 0)) {
        s.authentic = s.real;
      } else if (s.authentic.length > 0 && !isFallbackList(s.authentic, fallback.suggestions.authentic) && (s.real === (fallback.suggestions.real ?? fallback.suggestions.smooth) || s.real.length === 0)) {
        s.real = s.authentic;
      }
      return s;
    })(),
  } as QuickAdviceResponse;
}



