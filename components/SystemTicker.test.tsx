import { expect, test, describe } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";
import { SystemTicker } from "./SystemTicker";

describe("SystemTicker", () => {
  test("renders all system status messages", () => {
    const { getByText, getAllByText } = render(<SystemTicker />);
    
    // Check for the messages (they are duplicated 5 times in the marquee)
    expect(getAllByText("SYSTEM: ONLINE").length).toBe(5);
    expect(getAllByText("// TARGET: LOCKED").length).toBe(5);
    expect(getAllByText("// DETECTING LIES").length).toBe(5);
    expect(getAllByText("// PROTOCOL: ROAST").length).toBe(5);
    expect(getAllByText("*** DO NOT TEXT BACK ***").length).toBe(5);
    
    // Check for the pulse indicator
    const pulseIndicators = document.querySelectorAll(".animate-pulse");
    expect(pulseIndicators.length).toBe(5);
  });

  test("has the marquee animation class", () => {
    const { container } = render(<SystemTicker />);
    const marquee = container.querySelector(".animate-marquee");
    expect(marquee).toBeInTheDocument();
  });
});
