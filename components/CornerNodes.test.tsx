import { expect, test, describe } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";
import { CornerNodes } from "./CornerNodes";

describe("CornerNodes", () => {
  test("renders all four corner elements", () => {
    const { container } = render(<CornerNodes />);
    
    // Check for the 4 corner containers (direct children)
    const cornerContainers = container.firstChild?.childNodes;
    expect(cornerContainers?.length).toBe(4);
    
    // Check for the '+' indicators (using the text-zinc-600 class)
    const indicators = container.querySelectorAll(".text-zinc-600");
    expect(indicators.length).toBe(4);
    expect(indicators[0].textContent).toBe("+");
  });

  test("applies custom className", () => {
    const { container } = render(<CornerNodes className="custom-test-class" />);
    expect(container.firstChild).toHaveClass("custom-test-class");
  });
});
