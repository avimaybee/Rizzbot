import { QuickAdviceResponse, SuggestionOption } from "../types";

export const FALLBACK_PRO_TIP = "ngl couldn't read that one properly, try again";

/**
 * Normalize a raw model payload into a well-formed QuickAdviceResponse.
 * Behavior identical to the previous inline assembly in geminiService.
 */
export function normalizeQuickAdvice(parsed: any): QuickAdviceResponse {
  const normalize = (list: any): SuggestionOption[] =>
    Array.isArray(list) ? list.filter((o: any) => o && Array.isArray(o.replies) && o.replies.length > 0) : [];
  return {
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
    },
    proTip: parsed.proTip || FALLBACK_PRO_TIP,
    recommendedAction: parsed.recommendedAction || 'MATCH',
    degraded: parsed?.degraded === true,
  };
}

/**
 * Build the degraded fallback response returned when analysis fails.
 */
export function buildQuickFallback(): QuickAdviceResponse {
  const fallbackOption = {
    replies: [{ originalMessage: "their message", reply: "hey" }],
    conversationHook: "whats good"
  };
  return {
    vibeCheck: { theirEnergy: 'neutral', interestLevel: 50, redFlags: [], greenFlags: [] },
    suggestions: {
      smooth: [fallbackOption, fallbackOption, fallbackOption],
      bold: [fallbackOption, fallbackOption, fallbackOption],
      witty: [fallbackOption, fallbackOption, fallbackOption],
      authentic: [fallbackOption, fallbackOption, fallbackOption],
      yourStyle: [fallbackOption, fallbackOption, fallbackOption],
      wait: undefined
    },
    proTip: FALLBACK_PRO_TIP,
    recommendedAction: 'MATCH',
    degraded: true
  };
}

/**
 * Detect whether a quick advice response is the degraded fallback.
 */
export function isQuickAdviceDegraded(r: QuickAdviceResponse): boolean {
  if (r.degraded === true) return true;
  if (r.proTip === FALLBACK_PRO_TIP) return true;
  const first = r.suggestions.smooth?.[0]?.replies?.[0]?.reply;
  return first === "hey";
}

/**
 * Build the copy-all payload: replies joined by blank lines, plus hook.
 */
export function buildCopyPayload(option: SuggestionOption): string {
  const replies = option.replies.map((r) => r.reply).filter(Boolean).join("\n\n");
  const hook = option.conversationHook ? `\n\n${option.conversationHook}` : "";
  return `${replies}${hook}`;
}
