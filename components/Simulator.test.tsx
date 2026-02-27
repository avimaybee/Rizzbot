import { expect, test, describe, beforeEach } from "bun:test";
import { render, fireEvent, within } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { Simulator } from "./Simulator";
import { ToastProvider } from "./Toast";

describe("Simulator Setup View Redesign", () => {
  const mockOnBack = () => {};

  beforeEach(() => {
    localStorage.clear();
  });

  test("uses organic layout classes (glass, soft-edge)", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for the main container or sub-panels using organic/glass classes
    const organicElements = container.querySelectorAll('.soft-edge, .glass, .glass-dark');
    expect(organicElements.length).toBeGreaterThan(0);
  });

  test("uses tactical labels (label-sm) for form inputs", () => {
    const { getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for labels in the setup view
    const nameLabel = getByText(/NODE_ID/i);
    const contextLabel = getByText(/SITUATIONAL_CONTEXT/i);

    expect(nameLabel).toHaveClass('label-sm');
    expect(contextLabel).toHaveClass('label-sm');
  });

  test("uses tactical ModuleHeader with animation", () => {
    const { container, getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getByText(/PRACTICE_NODE_INIT/i)).toBeInTheDocument();
    const pulseElement = container.querySelector('.animate-pulse');
    expect(pulseElement).toBeInTheDocument();
  });

  test("allows entering a name and context", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const nameInput = getByPlaceholderText(/INPUT_IDENTITY_NODE/i);
    
    fireEvent.change(nameInput, { target: { value: 'JORDAN' } });
    expect(nameInput).toHaveValue('JORDAN');

    const contextButton = getByText(/TALKING_STAGE/i);
    fireEvent.click(contextButton);
    
    const datingOption = getByText(/DATING/i);
    fireEvent.click(datingOption);
    
    expect(getByText(/DATING/i)).toBeInTheDocument();
    expect(queryByText(/TALKING_STAGE/i)).not.toBeInTheDocument();
  });

  test("allows entering red flags", () => {
    const { getByPlaceholderText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const redFlagsInput = getByPlaceholderText(/DESCRIBE_BEHAVIORAL_FLAGS/i);
    
    fireEvent.change(redFlagsInput, { target: { value: 'Dry texter, leaves me on read.' } });
    expect(redFlagsInput).toHaveValue('Dry texter, leaves me on read.');
  });

  test("shows empty state when no personas are saved", () => {
    const { getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getByText(/Awaiting Node Creation/i)).toBeInTheDocument();
  });

  test("loads and displays saved personas from localStorage", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 3 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getAllByText('SOPHIE').length).toBeGreaterThan(0);
  });

  test("clicking a persona loads it into chat view", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 3 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText, getByText, queryByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const sophieButton = getAllByText('SOPHIE')[0].closest('button');
    if (sophieButton) {
      fireEvent.click(sophieButton);
    }
    
    // Check that we're now in chat view (UPLINK header should be there)
    expect(getByText(/UPLINK: SOPHIE/i)).toBeInTheDocument();
    const backButton = getByText(/BACK/i).closest('button');
    expect(backButton).toBeInTheDocument();
    
    // And "PRACTICE_NODE_INIT" should be gone
    expect(queryByText(/PRACTICE_NODE_INIT/i)).not.toBeInTheDocument();
  });

  test("displays difficulty indicators for personas", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 3 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const difficultyBadge = container.querySelector('.difficulty-indicator');
    expect(difficultyBadge).toBeInTheDocument();
  });

  test("shows Ghost Risk HUD in chat view when history exists", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 3 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const mockHistory = [
      { 
        draft: 'Hey', 
        result: { 
          predictedReply: 'Hi', 
          verdict: 'Good', 
          regretLevel: 20, 
          rewrites: { safe: 'Hello' } 
        } 
      }
    ];
    localStorage.setItem('unsend_sim_history_SOPHIE', JSON.stringify(mockHistory));

    const { getAllByText, container, getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const sophieButton = getAllByText('SOPHIE')[0].closest('button');
    if (sophieButton) {
      fireEvent.click(sophieButton);
    }

    expect(getByText(/UPLINK: SOPHIE/i)).toBeInTheDocument();
    
    const hud = container.querySelector('.ghost-risk-hud');
    expect(hud).toBeInTheDocument();
    expect(container.querySelector('.risk-meter')).toBeInTheDocument();
  });

  test("shows Mission Debrief report when in analysis view", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const report = container.querySelector('.mission-debrief-report');
    expect(report).toBeInTheDocument();
  });
});
