import { expect, test, describe } from "bun:test";
import {
  normalizeQuickAdvice,
  normalizeQuickAdviceResponse,
  buildQuickFallback,
  isQuickAdviceDegraded,
  buildCopyPayload,
  FALLBACK_PRO_TIP,
  QUICK_STYLES,
} from "./quickAdvice";
import { SuggestionOption, QuickAdviceResponse } from "../types";
import "../tests/setup";

const validOption = (reply: string): SuggestionOption => ({
  replies: [{ originalMessage: "their message", reply }],
  conversationHook: "whats good",
});

describe("normalizeQuickAdvice", () => {
  test("legacy fold: roast folds into bold when bold is absent", () => {
    const parsed = {
      suggestions: {
        smooth: [validOption("s1")],
        roast: [validOption("r1")],
        witty: [validOption("w1")],
        authentic: [validOption("a1")],
        yourStyle: [validOption("y1")],
      },
    };
    const result = normalizeQuickAdvice(parsed);
    expect(result.suggestions.bold).toEqual([validOption("r1")]);
    expect(result.suggestions).not.toHaveProperty("roast");
  });

  test("precedence: bold wins over roast when both exist", () => {
    const parsed = {
      suggestions: {
        bold: [validOption("b1")],
        roast: [validOption("r1")],
      },
    };
    const result = normalizeQuickAdvice(parsed);
    expect(result.suggestions.bold).toEqual([validOption("b1")]);
  });

  test("filtering: options with empty replies are dropped, empty tones become []", () => {
    const parsed = {
      suggestions: {
        smooth: [{ replies: [], conversationHook: "no" }, validOption("s1")],
        bold: [{ replies: [], conversationHook: "no" }],
      },
    };
    const result = normalizeQuickAdvice(parsed);
    expect(result.suggestions.smooth).toEqual([validOption("s1")]);
    expect(result.suggestions.bold).toEqual([]);
  });

  test("defaults: missing vibeCheck, proTip, recommendedAction; wait handling", () => {
    const parsed = {
      suggestions: { wait: "give it space" },
    };
    const result = normalizeQuickAdvice(parsed);
    expect(result.vibeCheck).toEqual({ theirEnergy: 'neutral', interestLevel: 50, redFlags: [], greenFlags: [] });
    expect(result.proTip).toBe(FALLBACK_PRO_TIP);
    expect(result.recommendedAction).toBe("MATCH");
    expect(result.suggestions.wait).toBe("give it space");
    expect(normalizeQuickAdvice({ suggestions: {} }).suggestions.wait).toBeNull();
  });

  test("marks a normal payload as not degraded", () => {
    const result = normalizeQuickAdvice({ suggestions: {} });
    expect(result.degraded).toBe(false);
  });
});

describe("buildQuickFallback", () => {
  test("returns 5 tones x 3 options, degraded shape", () => {
    const result = buildQuickFallback();
    for (const tone of ["smooth", "bold", "witty", "authentic", "yourStyle"] as const) {
      expect(result.suggestions[tone]).toHaveLength(3);
      for (const option of result.suggestions[tone]) {
        expect(option.replies).toHaveLength(1);
        expect(option.replies[0].reply).toBe("hey");
      }
    }
    expect(result.proTip).toBe(FALLBACK_PRO_TIP);
    expect(result.recommendedAction).toBe("MATCH");
  });

  test("marks the response as degraded", () => {
    expect(buildQuickFallback().degraded).toBe(true);
  });
});

describe("isQuickAdviceDegraded", () => {
  test("true for the fallback response", () => {
    expect(isQuickAdviceDegraded(buildQuickFallback())).toBe(true);
  });

  test("false for a normalized normal payload", () => {
    const result = normalizeQuickAdvice({
      proTip: "a real insight",
      suggestions: { smooth: [validOption("s1")] },
    });
    expect(isQuickAdviceDegraded(result)).toBe(false);
  });

  test("true when the degraded flag is set even if heuristic strings differ", () => {
    const result: QuickAdviceResponse = {
      ...normalizeQuickAdvice({
        proTip: "a custom proTip that is not the fallback string",
        suggestions: { smooth: [validOption("a real reply")] },
      }),
      degraded: true,
    };
    expect(isQuickAdviceDegraded(result)).toBe(true);
  });

  test("true via legacy heuristic when degraded is false but proTip is the fallback", () => {
    const result: QuickAdviceResponse = {
      ...normalizeQuickAdvice({ suggestions: { smooth: [validOption("s1")] } }),
      degraded: false,
      proTip: FALLBACK_PRO_TIP,
    };
    expect(isQuickAdviceDegraded(result)).toBe(true);
  });
});

describe("buildCopyPayload", () => {
  test("joins replies with blank lines and appends hook", () => {
    const option: SuggestionOption = {
      replies: [{ originalMessage: "m1", reply: "r1" }, { originalMessage: "m2", reply: "r2" }],
      conversationHook: "hook",
    };
    expect(buildCopyPayload(option)).toBe("r1\n\nr2\n\nhook");
  });

  test("single reply without hook", () => {
    const option: SuggestionOption = {
      replies: [{ originalMessage: "m1", reply: "r1" }],
      conversationHook: "",
    };
    expect(buildCopyPayload(option)).toBe("r1");
  });

  test("false/empty replies are filtered out", () => {
    const option: SuggestionOption = {
      replies: [
        { originalMessage: "m1", reply: "r1" },
        { originalMessage: "m2", reply: false as any },
        { originalMessage: "m3", reply: "" },
      ],
      conversationHook: "",
    };
    expect(buildCopyPayload(option)).toBe("r1");
  });
});

describe("V2 multi-bubble schema normalization", () => {
  test("multi-bubble options preserve bubbles and synthesize text", () => {
    const raw = {
      extractedUnrepliedMessages: ["hey", "  ", "what's up"],
      summary: "Sharp friend read.",
      shouldWait: false,
      suggestions: {
        real: [{ bubbles: [{ replyTo: "hey", text: "yo" }, { replyTo: null, text: "what's good" }] }],
        smooth: [{ bubbles: [{ replyTo: null, text: "smooth one" }] }],
        playful: [{ bubbles: [{ replyTo: null, text: "playful one" }] }],
        bold: [{ bubbles: [{ replyTo: null, text: "bold one" }] }],
        yourStyle: [{ bubbles: [{ replyTo: null, text: "your style one" }] }],
      },
    };
    const result = normalizeQuickAdviceResponse(raw as any);
    expect(result.extractedUnrepliedMessages).toEqual(["hey", "what's up"]);
    expect(result.summary).toBe("Sharp friend read.");
    expect(result.suggestions.real?.[0].bubbles).toHaveLength(2);
    expect(result.suggestions.real?.[0].text).toBe("yo\nwhat's good");
    // V1 bridge: playful -> witty, real -> authentic
    expect(result.suggestions.witty[0].text).toBe("playful one");
    expect(result.suggestions.authentic[0].text).toBe("yo\nwhat's good");
  });

  test("legacy V1 text synthesizes bubbles", () => {
    const raw = {
      suggestions: {
        smooth: [{ text: "hello", subtext: "why" }],
      },
    };
    const result = normalizeQuickAdviceResponse(raw as any);
    expect(result.suggestions.smooth[0].bubbles).toEqual([{ replyTo: null, text: "hello" }]);
    expect(result.suggestions.smooth[0].text).toBe("hello");
  });

  test("summary falls back to tacticalSummary and mirrors", () => {
    const raw = {
      tacticalSummary: "V1 summary here",
      suggestions: { smooth: [{ bubbles: [{ replyTo: null, text: "hi" }] }] },
    };
    const result = normalizeQuickAdviceResponse(raw as any);
    expect(result.summary).toBe("V1 summary here");
    expect(result.tacticalSummary).toBe("V1 summary here");
  });

  test("QUICK_STYLES order matches V2", () => {
    expect([...QUICK_STYLES]).toEqual(['real', 'smooth', 'playful', 'bold', 'yourStyle']);
  });

  test("V2 response with summary is not marked degraded and null replyTo maps to empty originalMessage", () => {
    const raw = {
      extractedUnrepliedMessages: ["u awake?"],
      summary: "She's testing if you're free tonight — keep it short and playful.",
      shouldWait: false,
      suggestions: {
        real: [{ bubbles: [{ replyTo: null, text: "barely, what's up" }] }],
        smooth: [{ bubbles: [{ replyTo: "u awake?", text: "for you maybe" }] }],
        playful: [{ bubbles: [{ replyTo: null, text: "depends who's asking" }] }],
        bold: [{ bubbles: [{ replyTo: null, text: "yeah come over" }] }],
        yourStyle: [{ bubbles: [{ replyTo: null, text: "yo wsp" }] }],
      },
    };
    const result = normalizeQuickAdviceResponse(raw as any);
    expect(isQuickAdviceDegraded(result)).toBe(false);
    expect(result.proTip).toBe("She's testing if you're free tonight — keep it short and playful.");
    expect(result.suggestions.real?.[0].replies[0].originalMessage).toBe("");
    expect(result.suggestions.smooth[0].replies[0].originalMessage).toBe("u awake?");
  });
});
