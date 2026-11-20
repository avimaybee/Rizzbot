import { expect, test, describe } from "bun:test";
import { QUICK_LOADING_LINES, shuffledLoadingLines, loadingLineForElapsed } from "./loadingLines";
import "../../tests/setup";

describe("loadingLines", () => {
  test("pool has organic lines with no fake precision", () => {
    expect(QUICK_LOADING_LINES.length).toBeGreaterThan(10);
    const banned = [/tab/i, /real.*smooth/i, /15 replies/i, /%/i, /\d+\s*(s|sec)/i, /model/i, /xhigh/i];
    for (const line of QUICK_LOADING_LINES) {
      for (const re of banned) {
        expect(line).not.toMatch(re);
      }
    }
  });

  test("shuffle is deterministic with seeded random and preserves membership", () => {
    const a = shuffledLoadingLines(() => 0.5);
    const b = shuffledLoadingLines(() => 0.5);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...QUICK_LOADING_LINES].sort());
  });

  test("line cycles every 6s through the pool", () => {
    const pool = ["a", "b", "c"];
    expect(loadingLineForElapsed(pool, 0)).toBe("a");
    expect(loadingLineForElapsed(pool, 5)).toBe("a");
    expect(loadingLineForElapsed(pool, 6)).toBe("b");
    expect(loadingLineForElapsed(pool, 18)).toBe("a");
  });

  test("empty pool falls back", () => {
    expect(loadingLineForElapsed([], 99)).toBe("thinking…");
  });
});
