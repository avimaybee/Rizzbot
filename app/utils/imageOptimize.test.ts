import { expect, test, describe } from "bun:test";
import {
  calculateScaledDimensions,
  isR2MediaKey,
  clampScreenshotList,
  MAX_QUICK_SCREENSHOTS,
} from "./imageOptimize";
import "../../tests/setup";

describe("calculateScaledDimensions", () => {
  test("portrait 1170x2532 scales to max 1280 height", () => {
    const out = calculateScaledDimensions(1170, 2532);
    expect(out.height).toBe(1280);
    expect(out.width).toBe(591);
  });

  test("landscape 2560x1440 scales to 1280 width", () => {
    const out = calculateScaledDimensions(2560, 1440);
    expect(out).toEqual({ width: 1280, height: 720 });
  });

  test("small image unchanged", () => {
    expect(calculateScaledDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("isR2MediaKey", () => {
  test("detects r2: keys", () => {
    expect(isR2MediaKey("r2:quick/uid123/123.webp")).toBe(true);
    expect(isR2MediaKey("quick/uid123/123.webp")).toBe(true);
    expect(isR2MediaKey("data:image/png;base64,abc")).toBe(false);
    expect(isR2MediaKey("abc123")).toBe(false);
  });
});

describe("clampScreenshotList", () => {
  test("clamps at 10 screenshots", () => {
    const existing = Array.from({ length: 8 }, (_, i) => `e${i}`);
    const incoming = ["n1", "n2", "n3", "n4"];
    expect(clampScreenshotList(existing, incoming)).toHaveLength(MAX_QUICK_SCREENSHOTS);
    expect(MAX_QUICK_SCREENSHOTS).toBe(10);
  });

  test("concatenates under limit", () => {
    expect(clampScreenshotList(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

