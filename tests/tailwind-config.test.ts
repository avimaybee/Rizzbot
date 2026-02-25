import { expect, test, describe } from "bun:test";
import tailwindConfig from "../tailwind.config.js";

describe("Tailwind Configuration - Fluid & Organic", () => {
  test("should have organic border radius", () => {
    expect(tailwindConfig.theme.extend.borderRadius.organic).toBeDefined();
    expect(tailwindConfig.theme.extend.borderRadius.organic).toBe("2rem");
  });

  test("should have organic spacing", () => {
    expect(tailwindConfig.theme.extend.spacing.organic).toBeDefined();
    expect(tailwindConfig.theme.extend.spacing.organic).toBe("3rem");
  });

  test("should have monospaced accent font family", () => {
    // The mono font already exists, but we want to ensure it's defined correctly for accents
    expect(tailwindConfig.theme.extend.fontFamily.mono).toBeDefined();
    expect(tailwindConfig.theme.extend.fontFamily.mono).toContain("Courier Prime");
  });
});
