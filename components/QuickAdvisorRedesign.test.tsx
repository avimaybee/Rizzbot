import { GlobalWindow } from 'happy-dom';
const window = new GlobalWindow();
// @ts-ignore
global.window = window;
// @ts-ignore
global.document = window.document;
// @ts-ignore
global.navigator = window.navigator;
// @ts-ignore
global.Node = window.Node;
// @ts-ignore
global.Element = window.Element;
// @ts-ignore
global.HTMLElement = window.HTMLElement;

import { expect, test, describe } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
// @ts-ignore
import QuickAdvisorRedesign from "./QuickAdvisorRedesign";

describe("QuickAdvisorRedesign Layout", () => {
  const defaultProps = {
    context: "",
    onContextChange: () => {},
    yourDraft: "",
    onDraftChange: () => {},
  };

  test("renders image preview at the top when screenshots are provided", () => {
    const mockScreenshots = ["data:image/png;base64,mock"];
    const { getByTestId } = render(
      <QuickAdvisorRedesign 
        {...defaultProps}
        screenshots={mockScreenshots} 
      />
    );
    
    const previewContainer = getByTestId("preview-container");
    expect(previewContainer).toBeInTheDocument();
    // Verify it's positioned before the actions
    expect(previewContainer.nextElementSibling).toHaveAttribute("data-testid", "actions-container");
  });

  test("is clean and minimal, without decorative HUD elements", () => {
    const { container, queryByText } = render(
      <QuickAdvisorRedesign 
        {...defaultProps}
        screenshots={[]} 
      />
    );
    
    expect(container.querySelector(".topo-pattern")).toBeNull();
    expect(container.querySelector(".scan-lines")).toBeNull();
    expect(queryByText("+")).toBeNull();
  });

  test("calls onUploadClick when upload area is clicked", () => {
    let onUploadClickCalled = false;
    const onUploadClick = () => { onUploadClickCalled = true; };
    const { getByText } = render(
      <QuickAdvisorRedesign 
        {...defaultProps}
        screenshots={[]} 
        onUploadClick={onUploadClick} 
      />
    );
    
    const uploadButton = getByText("Upload Evidence").closest("button");
    if (uploadButton) {
      fireEvent.click(uploadButton);
    }
    expect(onUploadClickCalled).toBe(true);
  });

  test("calls onAnalyzeClick when Get Advice is clicked", () => {
    let onAnalyzeClickCalled = false;
    const onAnalyzeClick = () => { onAnalyzeClickCalled = true; };
    const { getByText } = render(
      <QuickAdvisorRedesign 
        {...defaultProps}
        screenshots={["data:image/png;base64,mock"]} 
        onAnalyzeClick={onAnalyzeClick} 
      />
    );
    
    const analyzeButton = getByText("Get Advice").closest("button");
    if (analyzeButton) {
      fireEvent.click(analyzeButton);
    }
    expect(onAnalyzeClickCalled).toBe(true);
  });

  test("shows advanced options only when toggled", () => {
    const { queryByPlaceholderText, getByText, getByPlaceholderText } = render(
      <QuickAdvisorRedesign 
        {...defaultProps}
        screenshots={["data:image/png;base64,mock"]} 
      />
    );
    
    expect(queryByPlaceholderText("What's the vibe? Any history?")).toBeNull();
    
    const toggle = getByText("Add context / your draft");
    fireEvent.click(toggle);
    
    expect(getByPlaceholderText("What's the vibe? Any history?")).toBeInTheDocument();
  });
});
