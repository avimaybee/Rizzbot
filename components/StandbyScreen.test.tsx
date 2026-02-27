import { expect, test, describe, mock } from "bun:test";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { StandbyScreen } from "./StandbyScreen";
import { AuthUser } from "../services/firebaseService";

describe("StandbyScreen", () => {
  const mockOnActivate = mock(() => {});
  const mockAuthUser: AuthUser = {
    uid: "test-uid",
    email: "test@example.com",
    displayName: "Test User",
    photoURL: "https://example.com/photo.jpg",
    providerId: "google.com",
  };

  test("renders the RIZZBOT header and Zen background elements", () => {
    const { getByText, container } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={null} 
      />
    );

    expect(getByText("RIZZ")).toBeInTheDocument();
    expect(getByText("BOT")).toBeInTheDocument();
    
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
      />
    );

    expect(getByText(/\/\/ ID:/i)).toBeInTheDocument();
    expect(getByText("Test")).toBeInTheDocument(); // Display name split
    expect(getByText(/VOICE: CALIBRATED/i)).toBeInTheDocument();
  });

  test("shows UNINITIALIZED status when hasProfile is false", () => {
    const { getByText } = render(
      <StandbyScreen 
        onActivate={mockOnActivate} 
        hasProfile={false} 
        authUser={mockAuthUser} 
      />
    );

    expect(getByText(/VOICE: UNTRAINED/i)).toBeInTheDocument();
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
