import { expect, test, describe, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { WellbeingCheckIn } from "./WellbeingCheckIn";

describe("WellbeingCheckIn", () => {
  const mockOnDismiss = mock(() => {});
  const mockOnDismissForDay = mock(() => {});

  test("renders the late_night reason content", () => {
    const { getByText } = render(
      <WellbeingCheckIn 
        reason="late_night" 
        onDismiss={mockOnDismiss} 
        onDismissForDay={mockOnDismissForDay} 
      />
    );
    
    expect(getByText("it's late bestie")).toBeInTheDocument();
    expect(getByText("☾")).toBeInTheDocument();
  });

  test("renders the same_person reason content", () => {
    const { getByText } = render(
      <WellbeingCheckIn 
        reason="same_person" 
        onDismiss={mockOnDismiss} 
        onDismissForDay={mockOnDismissForDay} 
      />
    );
    
    expect(getByText("quick vibe check")).toBeInTheDocument();
    expect(getByText("↺")).toBeInTheDocument();
  });

  test("calls onDismiss when button is clicked", () => {
    const { getByText } = render(
      <WellbeingCheckIn 
        reason="high_frequency" 
        onDismiss={mockOnDismiss} 
        onDismissForDay={mockOnDismissForDay} 
      />
    );
    
    const dismissBtn = getByText("im good, keep going");
    fireEvent.click(dismissBtn);
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  test("calls onDismissForDay when button is clicked", () => {
    const { getByText } = render(
      <WellbeingCheckIn 
        reason="high_frequency" 
        onDismiss={mockOnDismiss} 
        onDismissForDay={mockOnDismissForDay} 
      />
    );
    
    const dismissForDayBtn = getByText("dont remind me today");
    fireEvent.click(dismissForDayBtn);
    expect(mockOnDismissForDay).toHaveBeenCalled();
  });
});
