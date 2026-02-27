import { expect, test, describe, mock, beforeEach } from "bun:test";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { StandbyScreen } from "./StandbyScreen";
import { AuthUser } from "../services/firebaseService";

// Mock dbService
mock.module("../services/dbService", () => ({
  getSessions: mock(() => Promise.resolve({ sessions: [], pagination: { total: 0 } })),
  getPersonas: mock(() => Promise.resolve([])),
}));

describe("StandbyScreen", () => {
  const mockOnActivate = mock(() => {});
  const mockAuthUser: AuthUser = {
    uid: "test-uid",
    email: "test@example.com",
    displayName: "Test User",
    photoURL: "https://example.com/photo.jpg",
    providerId: "google.com",
  };

  beforeEach(() => {
    mockOnActivate.mockClear();
  });

  test("renders the RIZZBOT header and Zen background elements", () => {
    const { getByText, container } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={null} 
        wellbeingReason={null}
      />
    );

    expect(getByText("RIZZ")).toBeInTheDocument();
    expect(getByText("BOT")).toBeInTheDocument();
    expect(getByText(/SYSTEM_OPTIMAL/i)).toBeInTheDocument();
    
    // Check for background elements
    const auroraBg = container.querySelector(".animate-aurora");
    const dotPattern = container.querySelector(".bg-dot-pattern");
    
    expect(auroraBg).toBeInTheDocument();
    expect(dotPattern).toBeInTheDocument();
  });

  test("renders the Instant Scan node and triggers activation", () => {
    const { getByText } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={null} 
      />
    );

    const scanNode = getByText("INSTANT SCAN");
    expect(scanNode).toBeInTheDocument();
    
    fireEvent.click(scanNode.closest('button')!);
    expect(mockOnActivate).toHaveBeenCalledWith('quick');
  });

  test("renders mode switchers and triggers activation", () => {
    const { getByText } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={null} 
      />
    );

    const practiceBtn = getByText("Practice").closest('button')!;
    const therapyBtn = getByText("Therapy").closest('button')!;
    
    expect(practiceBtn).toBeInTheDocument();
    expect(therapyBtn).toBeInTheDocument();
    
    fireEvent.click(practiceBtn);
    expect(mockOnActivate).toHaveBeenCalledWith('simulator');
    
    fireEvent.click(therapyBtn);
    expect(mockOnActivate).toHaveBeenCalledWith('therapist');
  });

  test("renders the Identity Node when authUser is provided", () => {
    const { getByText } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={true} 
        authUser={mockAuthUser} 
        wellbeingReason={null}
      />
    );

    expect(getByText(/\/\/ ID:/i)).toBeInTheDocument();
    expect(getByText("Test")).toBeInTheDocument(); // Display name split
    expect(getByText(/VOICE: CALIBRATED/i)).toBeInTheDocument();
  });

  test("shows UNINITIALIZED status and checklist when hasProfile is false", () => {
    const { getByText, getAllByText } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={mockAuthUser} 
        wellbeingReason={null}
      />
    );

    expect(getByText(/VOICE: UNTRAINED/i)).toBeInTheDocument();
    expect(getAllByText(/SYSTEM_INITIALIZATION/i).length).toBeGreaterThan(0);
    expect(getAllByText(/VOICE_CALIBRATION/i).length).toBeGreaterThan(0);
  });

  test("renders specific wellbeing alerts", () => {
    const { getByText, rerender } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={true} 
        authUser={mockAuthUser} 
        wellbeingReason="late_night"
      />
    );
    expect(getByText(/SLEEP_DEPRIVED/i)).toBeInTheDocument();

    rerender(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={true} 
        authUser={mockAuthUser} 
        wellbeingReason="same_person"
      />
    );
    expect(getByText(/TARGET_OBSESSION/i)).toBeInTheDocument();
  });

  test("renders abstract grid visual", () => {
    const { container } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={null} 
      />
    );

    const svg = container.querySelector("svg.animate-spin-slow");
    expect(svg).toBeInTheDocument();
  });
});
