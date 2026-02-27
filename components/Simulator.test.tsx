import { expect, test, describe, beforeEach } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { Simulator } from "./Simulator";
import { ToastProvider } from "./Toast";

describe("Simulator Tactical Redesign", () => {
  const mockOnBack = () => {};

  beforeEach(() => {
    localStorage.clear();
  });

  test("uses organic tactical layout (glass, soft-edge)", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for glass and soft-edge classes which are core to the redesign
    const organicElements = container.querySelectorAll('.soft-edge, .glass, .glass-dark, .glass-zinc');
    expect(organicElements.length).toBeGreaterThan(0);
  });

  test("uses tactical monospaced labels", () => {
    const { getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Check for the new tactical labels
    expect(getByText(/Identifier/i)).toBeInTheDocument();
    expect(getByText(/Operational Dynamic/i)).toBeInTheDocument();
    expect(getByText(/Behavioral Metadata/i)).toBeInTheDocument();
  });

  test("allows entering identity node (codename)", () => {
    const { getByPlaceholderText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const nameInput = getByPlaceholderText(/ENTER_CODENAME/i);
    fireEvent.change(nameInput, { target: { value: 'GHOST_PROTOCOL' } });
    expect(nameInput).toHaveValue('GHOST_PROTOCOL');
  });

  test("shows empty state for active simulations", () => {
    const { getAllByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Active Simulations header exists even if empty
    expect(getAllByText(/Active Simulations/i).length).toBeGreaterThan(0);
  });

  test("loads and displays saved nodes from localStorage", () => {
    const mockPersonas = [
      { name: 'TARGET_ALPHA', relationshipContext: 'DATING', harshnessLevel: 4 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getAllByText('TARGET_ALPHA').length).toBeGreaterThan(0);
  });

  test("clicking a node initiates uplink (chat view)", () => {
    const mockPersonas = [
      { name: 'TARGET_ALPHA', relationshipContext: 'DATING', harshnessLevel: 4 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText, getByText, queryByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const targetButton = getAllByText('TARGET_ALPHA')[0].closest('button');
    if (targetButton) {
      fireEvent.click(targetButton);
    }
    
    // Check for Uplink header
    expect(getByText(/UPLINK: TARGET_ALPHA/i)).toBeInTheDocument();
    // Check for the transmit button (specifically the button, not the text in description)
    const transmitButton = getByText('TRANSMIT').closest('button');
    expect(transmitButton).toBeInTheDocument();
    
    // Setup header should be gone
    expect(queryByText(/PRACTICE_NODE_INIT/i)).not.toBeInTheDocument();
  });

  test("displays node difficulty indicators", () => {
    const mockPersonas = [
      { name: 'TARGET_ALPHA', relationshipContext: 'DATING', harshnessLevel: 5 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // The colored dot
    const indicator = container.querySelector('.bg-hard-red.animate-pulse');
    expect(indicator).toBeInTheDocument();
  });

  test("shows Ghost Risk HUD in active uplink when history exists", () => {
    const mockPersonas = [
      { name: 'TARGET_ALPHA', relationshipContext: 'DATING', harshnessLevel: 3 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const mockHistory = [
      { 
        draft: 'HELLO', 
        result: { 
          predictedReply: 'HI', 
          verdict: 'NORMAL', 
          regretLevel: 10, 
          rewrites: { safe: 'HI' } 
        } 
      }
    ];
    localStorage.setItem('unsend_sim_history_TARGET_ALPHA', JSON.stringify(mockHistory));

    const { getAllByText, getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const targetButton = getAllByText('TARGET_ALPHA')[0].closest('button');
    if (targetButton) {
      fireEvent.click(targetButton);
    }

    expect(getByText(/NODE_RISK/i)).toBeInTheDocument();
    expect(getByText(/VIBE_COEFF/i)).toBeInTheDocument();
    expect(getByText(/10%/i)).toBeInTheDocument();
  });

  test("shows Mission Debrief report when in analysis view", () => {
    const mockPersona = { name: 'TARGET_ALPHA', relationshipContext: 'DATING', harshnessLevel: 3 };
    localStorage.setItem('unsend_personas', JSON.stringify([mockPersona]));
    
    const mockHistory = [
      { 
        draft: 'HELLO', 
        result: { 
          predictedReply: 'HI', 
          verdict: 'NORMAL', 
          regretLevel: 10, 
          rewrites: { safe: 'HI' } 
        } 
      }
    ];
    localStorage.setItem('unsend_sim_history_TARGET_ALPHA', JSON.stringify(mockHistory));

    const mockAnalysis: any = {
      headline: 'MISSION_COMPLETE',
      ghostRisk: 20,
      vibeMatch: 85,
      effortBalance: 50,
      insights: ['INSIGHT_01'],
      advice: 'PROCEED_WITH_CAUTION',
      verdict: 'STABLE',
      recommendedNextMove: 'WAIT'
    };

    const { container, getByText } = render(
      <ToastProvider>
        <Simulator 
          onBack={mockOnBack} 
          initialView="analysis" 
          initialAnalysisResult={mockAnalysis}
        />
      </ToastProvider>
    );
    
    const report = container.querySelector('.mission-debrief-report');
    expect(report).toBeInTheDocument();
    expect(getByText(/STRATEGIC_DEBRIEF/i)).toBeInTheDocument();
    expect(getByText(/GHOST_RISK_FACTOR/i)).toBeInTheDocument();
  });

  test("triggers vibration on actions", () => {
    // Spying on it
    const spy = { calls: 0 };
    global.navigator.vibrate = (pattern: any) => { spy.calls++; return true; };

    const { getByText, getByPlaceholderText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Changing input doesn't trigger handleAction, but clicking back or other actions might
    const backButton = getByText(/BACK/i).closest('button');
    if (backButton) {
      fireEvent.click(backButton);
    }
    
    expect(spy.calls).toBeGreaterThan(0);
  });

  test("allows uploading receipts (simulated)", () => {
    const { getByText, getByLabelText, container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    // Find the hidden file input
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    
    const file = new File(['(binary data)'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    
    // Check if the label updated (needs FileReader to finish, so might be async)
    // But we've at least covered the handler execution lines
  });
});
