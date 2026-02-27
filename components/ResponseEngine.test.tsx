import { expect, test, describe } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import ResponseEngine from "./ResponseEngine";
import "../tests/setup";

describe("ResponseEngine Layout", () => {
  const defaultProps = {
    screenshots: [],
    onRemoveScreenshot: () => {},
    onUploadClick: () => {},
    onAnalyzeClick: () => {},
    isLoading: false,
    context: "",
    onContextChange: () => {},
    yourDraft: "",
    onDraftChange: () => {},
    onBack: () => {},
  };

  test("renders upload area when no screenshots provided", () => {
    const { getByText } = render(<ResponseEngine {...defaultProps} />);
    expect(getByText(/Upload Screenshots/i)).toBeTruthy();
  });

  test("renders image preview when screenshots are provided", () => {
    const mockScreenshots = ["data:image/png;base64,mock"];
    const { getByTestId } = render(
      <ResponseEngine 
        {...defaultProps}
        screenshots={mockScreenshots} 
      />
    );
    
    const previewContainer = getByTestId("preview-container");
    expect(previewContainer).toBeTruthy();
  });

  test("calls onUploadClick when upload area is clicked", () => {
    let onUploadClickCalled = false;
    const onUploadClick = () => { onUploadClickCalled = true; };
    const { getByText } = render(
      <ResponseEngine 
        {...defaultProps}
        onUploadClick={onUploadClick} 
      />
    );
    
    const uploadButton = getByText(/Upload Screenshots/i).closest("button");
    if (uploadButton) {
      fireEvent.click(uploadButton);
    }
    expect(onUploadClickCalled).toBe(true);
  });

  test("shows advanced options only when toggled", () => {
    const { queryByPlaceholderText, getByText, getByPlaceholderText } = render(
      <ResponseEngine 
        {...defaultProps}
        screenshots={["data:image/png;base64,mock"]} 
      />
    );
    
    expect(queryByPlaceholderText(/What's the relationship history/i)).toBeNull();
    
    const toggle = getByText(/Provide Context|Add Context/i);
    fireEvent.click(toggle);
    
    expect(getByPlaceholderText(/What's the relationship history/i)).toBeTruthy();
  });
});
