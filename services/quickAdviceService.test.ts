import { expect, test, describe } from "bun:test";
import { formatAbstractStyleHints, buildQuickModePrompt } from "./quickAdviceService";
import "../tests/setup";
import type { UserStyleProfile } from "../types";

const baitProfile: UserStyleProfile = {
  emojiUsage: "minimal",
  capitalization: "lowercase",
  punctuation: "minimal",
  averageLength: "short",
  slangLevel: "casual",
  signaturePatterns: ["wait really?? tells me everything", "nah you're good what happened"],
  preferredTone: "chill",
  rawSamples: ["wait really?? tells me everything i need to know lol"],
  learnedSamples: ["yo whats good", "haha bet"],
  cadenceNotes: "Short lowercase bursts.",
  energy: "medium",
};

describe("anti-parrot: style hints never carry literal user text", () => {
  test("formatAbstractStyleHints excludes signature/raw/learned samples", () => {
    const hints = formatAbstractStyleHints(baitProfile);
    for (const literal of [
      ...baitProfile.signaturePatterns,
      ...(baitProfile.rawSamples ?? []),
      ...(baitProfile.learnedSamples ?? []),
    ]) {
      expect(hints).not.toContain(literal);
    }
    // Structural abstraction + cadence still present
    expect(hints).toContain("lowercase");
    expect(hints).toContain("Short lowercase bursts.");
  });

  test("buildQuickModePrompt never embeds literal samples", () => {
    const prompt = buildQuickModePrompt({
      inputText: "their message here",
      stage: "talking",
      styleProfile: baitProfile,
      imageCount: 1,
    });
    for (const literal of [
      ...baitProfile.signaturePatterns,
      ...(baitProfile.rawSamples ?? []),
      ...(baitProfile.learnedSamples ?? []),
    ]) {
      expect(prompt).not.toContain(literal);
    }
  });

  test("null profile degrades to screenshot inference, not empty", () => {
    const hints = formatAbstractStyleHints(null);
    expect(hints.length).toBeGreaterThan(0);
  });
});
