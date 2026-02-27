import { expect, test, describe, vi, beforeEach } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
// @ts-ignore
import QuickAdvisorResultsRedesign from "./QuickAdvisorResultsRedesign";
// @ts-ignore
import { ToastContext } from "./Toast";

const mockResult = {
  vibeCheck: {
    theirEnergy: 'High',
    interestLevel: 85,
    greenFlags: ['Quick replies'],
    redFlags: [],
  },
  recommendedAction: 'STAY_SMOOTH',
  suggestions: {
    smooth: [{ replies: [{ reply: 'Hey there' }] }],
    bold: [],
    witty: [],
    authentic: [],
  },
  proTip: 'Keep it casual.',
};

const mockShowToast = vi.fn();

const renderWithToast = (ui: React.ReactElement) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      {ui}
    </ToastContext.Provider>
  );
};

describe("QuickAdvisorResultsRedesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders results correctly with Monospaced Accents", () => {
    const { getByText } = renderWithToast(
      <QuickAdvisorResultsRedesign 
        result={mockResult} 
        onNewScan={() => {}} 
        onFeedback={() => {}} 
      />
    );
    
    expect(getByText("Analysis Live")).toBeInTheDocument();
    expect(getByText("85%")).toHaveClass("font-mono");
    expect(getByText("High Energy")).toBeInTheDocument();
    expect(getByText("Keep it casual.")).toHaveClass("font-mono");
  });

  test("calls haptic feedback on copy", async () => {
    const vibrateMock = global.navigator.vibrate;
    const { getByText } = renderWithToast(
      <QuickAdvisorResultsRedesign 
        result={mockResult} 
        onNewScan={() => {}} 
        onFeedback={() => {}} 
      />
    );
    
    const copyButton = getByText("Hey there").closest("button");
    if (copyButton) {
      fireEvent.click(copyButton);
    }
    
    expect(vibrateMock).toHaveBeenCalledWith(10);
    expect(mockShowToast).toHaveBeenCalledWith("Copied", "success");
  });

  test("calls feedback callback with haptics", () => {
    const vibrateMock = global.navigator.vibrate;
    const onFeedback = vi.fn();
    const { container } = renderWithToast(
      <QuickAdvisorResultsRedesign 
        result={mockResult} 
        onNewScan={() => {}} 
        onFeedback={onFeedback} 
      />
    );
    
    // Find first feedback button (helpful)
    const feedbackBtn = container.querySelector('button .lucide-thumbs-up')?.closest('button');
    if (feedbackBtn) {
      fireEvent.click(feedbackBtn);
    }
    
    expect(vibrateMock).toHaveBeenCalledWith(5);
    expect(onFeedback).toHaveBeenCalledWith('smooth', 'helpful');
  });

  test("new diagnostic button triggers callback and haptics", () => {
    const vibrateMock = global.navigator.vibrate;
    const onNewScan = vi.fn();
    const { getByText } = renderWithToast(
      <QuickAdvisorResultsRedesign 
        result={mockResult} 
        onNewScan={onNewScan} 
        onFeedback={() => {}} 
      />
    );
    
    fireEvent.click(getByText("New Diagnostic"));
    
    expect(vibrateMock).toHaveBeenCalledWith(5);
    expect(onNewScan).toHaveBeenCalled();
  });
});
