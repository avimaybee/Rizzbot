import "../tests/setup";
import { expect, test, describe } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { StyleRadar } from "./StyleRadar";

describe("StyleRadar Component", () => {
  const mockProfile = {
    emojiUsage: 'moderate',
    capitalization: 'lowercase',
    punctuation: 'minimal',
    averageLength: 'medium',
    slangLevel: 'casual',
    preferredTone: 'chill'
  } as any;

  test("renders SVG and axis labels", () => {
    const { container, getByText } = render(<StyleRadar profile={mockProfile} />);
    
    // Check if SVG exists
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    // Check for labels (case insensitive as they might be uppercase in UI)
    expect(getByText(/SLANG/i)).toBeInTheDocument();
    expect(getByText(/EMOJI/i)).toBeInTheDocument();
    expect(getByText(/WARMTH/i)).toBeInTheDocument();
    expect(getByText(/PUNCT/i)).toBeInTheDocument();
    expect(getByText(/VOLUME/i)).toBeInTheDocument();
  });

  test("renders radar polygon", () => {
    const { container } = render(<StyleRadar profile={mockProfile} />);
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
    
    // Check for some data points being calculated
    const points = polygon?.getAttribute('points');
    expect(points).toBeTruthy();
    expect(points?.split(' ').length).toBeGreaterThanOrEqual(5);
  });
});
