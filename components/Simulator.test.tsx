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

  test("shows empty state when no personas are saved", () => {
    localStorage.clear();
    const { getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getByText(/No saved personas yet/i)).toBeInTheDocument();
  });

  test("loads and displays saved personas from localStorage", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', tone: 'Spicy' },
      { name: 'JACK', relationshipContext: 'EX', tone: 'Cold' }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for names in the sidebar (appears twice due to mobile/desktop views)
    expect(getAllByText('SOPHIE').length).toBeGreaterThan(0);
    expect(getAllByText('JACK').length).toBeGreaterThan(0);
  });

  test("clicking a persona loads it into chat view", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', tone: 'Spicy' }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText, getByText, queryByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Pick the desktop one or any of them
    const sophieButton = getAllByText('SOPHIE')[0].closest('button');
    if (sophieButton) {
      fireEvent.click(sophieButton);
    }
    
    // Check that we're now in chat view (CHAT_ENGAGEMENT header should be there)
    expect(getByText(/CHAT_ENGAGEMENT/i)).toBeInTheDocument();
    const backButton = getByText(/BACK/i).closest('button');
    expect(backButton).toBeInTheDocument();
    
    // And "Who's got you in your head?" should be gone
    expect(queryByText(/WHO'S GOT YOU IN YOUR HEAD/i)).not.toBeInTheDocument();
  });

  test("displays difficulty indicators for personas", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', tone: 'Spicy' }
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

    // Seed history so HUD shows up
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

    // Verify we are in chat view
    expect(getByText(/CHAT_ENGAGEMENT/i)).toBeInTheDocument();
    
    // Check for HUD container
    const hud = container.querySelector('.ghost-risk-hud');
    expect(hud).toBeInTheDocument();
    
    // Check for meters
    expect(container.querySelector('.risk-meter')).toBeInTheDocument();
    expect(container.querySelector('.vibe-meter')).toBeInTheDocument();
  });
});
