import { expect, test, describe } from "bun:test";
import {
  normalizeQuickAdvice,
  buildQuickFallback,
  isQuickAdviceDegraded,
  buildCopyPayload,
  FALLBACK_PRO_TIP,
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
