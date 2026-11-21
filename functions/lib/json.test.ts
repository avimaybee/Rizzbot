import { expect, test, describe } from "bun:test";
import { toDataUrl, cleanJsonObject, base64ToBytes } from "./json";
import { validateQuickV2Payload } from "../api/opencode/quick";

describe("toDataUrl", () => {
  test("passes data: URLs through untouched", () => {
    expect(toDataUrl("image/png", "data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });

  test("builds data URL with explicit mime", () => {
    expect(toDataUrl("image/webp", "abc123")).toBe("data:image/webp;base64,abc123");
  });

  test("defaults missing mime to webp", () => {
    expect(toDataUrl("", "abc123")).toBe("data:image/webp;base64,abc123");
  });
});

describe("cleanJsonObject", () => {
  test("parses plain JSON", () => {
    expect(cleanJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  test("strips ```json fences", () => {
    expect(cleanJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test("strips bare ``` fences", () => {
    expect(cleanJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test("extracts object from surrounding prose", () => {
    expect(cleanJsonObject('Sure! {"a":1} hope this helps')).toEqual({ a: 1 });
  });

  test("throws on non-JSON with model-style message", () => {
    expect(() => cleanJsonObject("no json here at all")).toThrow("Model output did not contain valid JSON");
  });

  test("throws on empty string", () => {
    expect(() => cleanJsonObject("   ")).toThrow();
  });
});

describe("base64ToBytes", () => {
  test("decodes raw base64", () => {
    expect(Array.from(base64ToBytes("aGk="))).toEqual([104, 105]);
  });

  test("strips data: URL prefix", () => {
    expect(Array.from(base64ToBytes("data:image/webp;base64,aGk="))).toEqual([104, 105]);
  });
});

const tabWith = (text: string) => [{ bubbles: [{ replyTo: null as string | null, text }] }];

const validPayload = (): Record<string, unknown> => ({
  suggestions: {
    real: tabWith("r"),
    smooth: tabWith("s"),
    playful: tabWith("p"),
    bold: tabWith("b"),
    yourStyle: tabWith("y"),
  },
  summary: "sharp friend read",
});

describe("validateQuickV2Payload", () => {
  test("accepts a minimal valid V2 payload", () => {
    expect(() => validateQuickV2Payload(validPayload())).not.toThrow();
  });

  test("accepts legacy single-text options", () => {
    const p = validPayload() as any;
    p.suggestions.real = [{ text: "hello" }];
    expect(() => validateQuickV2Payload(p)).not.toThrow();
  });

  test("rejects missing suggestions", () => {
    expect(() => validateQuickV2Payload({ summary: "x" })).toThrow("suggestions");
  });

  test("rejects an empty tab", () => {
    const p = validPayload() as any;
    p.suggestions.bold = [];
    expect(() => validateQuickV2Payload(p)).toThrow("bold");
  });

  test("rejects a tab whose first option has no usable text", () => {
    const p = validPayload() as any;
    p.suggestions.playful = [{ bubbles: [{ replyTo: null, text: "   " }] }];
    expect(() => validateQuickV2Payload(p)).toThrow("playful");
  });

  test("rejects missing summary", () => {
    const p = validPayload() as any;
    delete p.summary;
    expect(() => validateQuickV2Payload(p)).toThrow("summary");
  });
});
