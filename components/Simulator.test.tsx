import { expect, test, describe, beforeEach } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { Simulator } from "./Simulator";
import { ToastProvider } from "./Toast";

describe("Simulator Professional Redesign", () => {
  const mockOnBack = () => {};

  beforeEach(() => {
    localStorage.clear();
  });

  test("uses organic professional layout (glass, soft-edge)", () => {
    const { container } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const organicElements = container.querySelectorAll('.soft-edge, .glass, .glass-dark, .glass-zinc');
    expect(organicElements.length).toBeGreaterThan(0);
  });

  test("uses professional labels", () => {
    const { getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getByText(/Name/i)).toBeInTheDocument();
    expect(getByText(/Context/i)).toBeInTheDocument();
    expect(getByText(/Persona Details/i)).toBeInTheDocument();
  });

  test("allows entering identity (name)", () => {
    const { getByPlaceholderText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const nameInput = getByPlaceholderText(/Enter name/i);
    fireEvent.change(nameInput, { target: { value: 'SOPHIE' } });
    expect(nameInput).toHaveValue('SOPHIE');
  });

  test("loads and displays saved personas from localStorage", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 4 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    expect(getAllByText('SOPHIE').length).toBeGreaterThan(0);
  });

  test("clicking a persona initiates chat", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 4 }
    ];
    localStorage.setItem('unsend_personas', JSON.stringify(mockPersonas));

    const { getAllByText, getByText, queryByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const targetButton = getAllByText('SOPHIE')[0].closest('button');
    if (targetButton) {
      fireEvent.click(targetButton);
    }
    
    expect(getByText(/Chatting with SOPHIE/i)).toBeInTheDocument();
    expect(queryByText(/Simulator Setup/i)).not.toBeInTheDocument();
  });

  test("shows Risk HUD in active chat when history exists", () => {
    const mockPersonas = [
      { name: 'SOPHIE', relationshipContext: 'DATING', harshnessLevel: 3 }
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
    localStorage.setItem('unsend_sim_history_SOPHIE', JSON.stringify(mockHistory));

    const { getAllByText, getByText } = render(
      <ToastProvider>
        <Simulator onBack={mockOnBack} />
      </ToastProvider>
    );
    
    const targetButton = getAllByText('SOPHIE')[0].closest('button');
    if (targetButton) {
      fireEvent.click(targetButton);
    }

    expect(getByText(/Ghost Risk/i)).toBeInTheDocument();
    expect(getByText(/Vibe Coefficient/i)).toBeInTheDocument();
    expect(getByText(/10%/i)).toBeInTheDocument();
  });

  test("shows Session Debrief report when in analysis view", () => {
    const mockAnalysis: any = {
      headline: 'Conversation Complete',
      ghostRisk: 20,
      vibeMatch: 85,
      effortBalance: 50,
      insights: ['Good flow observed'],
      advice: 'Stay consistent',
      verdict: 'Success'
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
    
    expect(getByText(/Session Debrief/i)).toBeInTheDocument();
    expect(getByText(/GHOST RISK/i)).toBeInTheDocument();
  });
});
