import { expect, test, describe } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { Simulator } from "./Simulator";
import { ToastProvider } from "./Toast";

describe("Simulator Setup View Redesign", () => {
  const mockOnBack = () => {};

  test("uses organic layout classes (soft-edge, glass-zinc/dark)", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for the main container or sub-panels using organic/glass classes
    const organicElements = container.querySelectorAll('.soft-edge, .glass-zinc, .glass-dark');
    expect(organicElements.length).toBeGreaterThan(0);
  });

  test("uses fluid typography for main headings", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const fluidHeadings = container.querySelectorAll('.text-fluid-title, .text-fluid-subtitle');
    expect(fluidHeadings.length).toBeGreaterThan(0);
  });

  test("uses tactical labels (label-sm) for all form inputs", () => {
    const { getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for specific labels that should be using tactical styling
    const checkLabelClass = (text: string | RegExp) => {
      const el = getByText(text);
      const label = el.closest('label') || el;
      expect(label.className).toContain('label-sm');
    };

    checkLabelClass(/Their Name/i);
    checkLabelClass(/The Situationship/i);
    checkLabelClass(/Feedback Style/i);
    checkLabelClass(/Their Red Flags/i);
  });

  test("uses tactical HUD header with pulse animation", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const pulseElement = container.querySelector('.animate-pulse');
    expect(pulseElement).toBeInTheDocument();
  });

  test("allows entering a name and context", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const nameInput = getByPlaceholderText(/ALEX/i);
    
    fireEvent.change(nameInput, { target: { value: 'JORDAN' } });
    expect(nameInput).toHaveValue('JORDAN');

    const contextButton = getByText(/TALKING STAGE/i);
    fireEvent.click(contextButton);
    
    const datingOption = getByText(/DATING/i);
    fireEvent.click(datingOption);
    
    expect(getByText(/DATING/i)).toBeInTheDocument();
    expect(queryByText(/TALKING STAGE/i)).not.toBeInTheDocument();
  });

  test("allows entering red flags", () => {
    const { getByPlaceholderText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const redFlagsInput = getByPlaceholderText(/Describe their vibe/i);
    
    fireEvent.change(redFlagsInput, { target: { value: 'Dry texter, leaves me on read.' } });
    expect(redFlagsInput).toHaveValue('Dry texter, leaves me on read.');
  });
});
