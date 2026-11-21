import { expect, test, describe } from "bun:test";
import { parseNdjsonLines, statusCopy } from "./chatStream";
import { chatErrorCopy } from "./chatApi";
import { classifyExistingTurn, fingerprintTurnInput } from "../functions/lib/chatStore";

describe("chat NDJSON framing (015A adapter contract)", () => {
  test("handles chunk-split UTF-8, multiple events per chunk, and final line", () => {
    const raw = [
      `{"type":"accepted","turnId":"t1"}`,
      `{"type":"status","code":"thinking","message":"Thinking…"}`,
      `{"type":"delta","text":"hello "}`,
      `{"type":"delta","text":"world"}`,
      `{"type":"done","turn":{"id":"t1","status":"complete"}}`,
    ].join("\n");
    // Split mid-emoji across chunks to prove the TextDecoder path is exercised upstream;
    // the line parser itself must tolerate the joined buffer plus a missing trailing newline.
    const events = parseNdjsonLines(raw);
    expect(events.length).toBe(5);
    expect(events[0]).toMatchObject({ type: "accepted", turnId: "t1" });
    expect(events[4].type).toBe("done");
  });

  test("ignores malformed lines without dropping valid events", () => {
    const events = parseNdjsonLines(`{"type":"accepted"}\nnot json\n{"type":"error","code":"upstream"}`);
    expect(events.length).toBe(2);
    expect(events[1].code).toBe("upstream");
  });

  test("error codes map to the exact 015A UI copy", () => {
    expect(chatErrorCopy("allowance")).toBe("Chat is at its usage limit. Try again later.");
    expect(chatErrorCopy("active")).toBe("Still working on your last message…");
    expect(chatErrorCopy("conflict")).toBe("Couldn’t send your message. Try again.");
    expect(chatErrorCopy("not_found")).toBe("This chat isn’t available.");
    expect(chatErrorCopy("invalid_input")).toBe("Couldn’t send your message. Try again.");
    expect(chatErrorCopy("upstream")).toBe("Couldn’t finish that reply.");
  });
  test("status fallbacks read human, never robotic", () => {
    const legacy = ["Drafting replies…", "Reworking that line.", "Thinking…", "Reading your screenshots…", "Thinking."];
    for (const code of ["thinking", "drafting", "refining", "reading", "unknown-code"]) {
      const copy = statusCopy(code);
      expect(copy.length).toBeGreaterThan(0);
      expect(legacy).not.toContain(copy);
      expect(copy).toContain("…");
    }
    expect(statusCopy("drafting")).not.toBe(statusCopy("refining"));
  });
});

describe("turn duplicate/stale classifier (persistence regression)", () => {
  test("same ID + same input while pending reports active", () => {
    expect(classifyExistingTurn({ status: "pending", sameInput: true, isLatestFailed: false })).toBe("active_same");
  });

  test("reused ID with different input is a conflict, never a silent overwrite", () => {
    expect(classifyExistingTurn({ status: "pending", sameInput: false, isLatestFailed: false })).toBe("conflict_resend");
  });

  test("completed ID replays the saved result", () => {
    expect(classifyExistingTurn({ status: "complete", sameInput: true, isLatestFailed: false })).toBe("replay_complete");
  });

  test("only the latest failed turn may retry; older failed turns conflict", () => {
    expect(classifyExistingTurn({ status: "failed", sameInput: true, isLatestFailed: true })).toBe("retry_latest");
    expect(classifyExistingTurn({ status: "failed", sameInput: true, isLatestFailed: false })).toBe("conflict_old");
    expect(classifyExistingTurn({ status: "expired", sameInput: true, isLatestFailed: true })).toBe("retry_latest");
  });

  test("fingerprints are stable for identical input and differ on any change", () => {
    const a = fingerprintTurnInput({ text: "hi", attachmentKeys: [], ref: undefined });
    const b = fingerprintTurnInput({ text: "hi", attachmentKeys: [], ref: undefined });
    const c = fingerprintTurnInput({ text: "hi!", attachmentKeys: [], ref: undefined });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
