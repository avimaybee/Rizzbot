import { expect, test, describe, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { SideDock } from "./SideDock";
import { AuthUser } from "../services/firebaseService";

describe("SideDock", () => {
  const mockSetModule = mock(() => {});
  const mockOnSignOut = mock(() => {});
  const mockAuthUser: AuthUser = {
    uid: "test-uid",
    email: "test@example.com",
    displayName: "Test User",
    photoURL: null,
    providerId: "password",
  };

  test("renders all dock items", () => {
    const { getByText } = render(
      <SideDock 
        activeModule="standby" 
        setModule={mockSetModule} 
      />
    );
    
    expect(getByText("SYS")).toBeInTheDocument();
    expect(getByText("QUICK")).toBeInTheDocument();
    expect(getByText("PRACTICE")).toBeInTheDocument();
    expect(getByText("HISTORY")).toBeInTheDocument();
    expect(getByText("THERAPY")).toBeInTheDocument();
    expect(getByText("PROFILE")).toBeInTheDocument();
  });

  test("calls setModule when a dock item is clicked", () => {
    const { getByText } = render(
      <SideDock 
        activeModule="standby" 
        setModule={mockSetModule} 
      />
    );
    
    const quickItem = getByText("QUICK").parentElement!;
    fireEvent.click(quickItem);
    expect(mockSetModule).toHaveBeenCalledWith("quick");
    
    const practiceItem = getByText("PRACTICE").parentElement!;
    fireEvent.click(practiceItem);
    expect(mockSetModule).toHaveBeenCalledWith("simulator");
  });

  test("renders user avatar when authUser is provided", () => {
    const { getByText } = render(
      <SideDock 
        activeModule="standby" 
        setModule={mockSetModule} 
        authUser={mockAuthUser}
      />
    );
    
    // AuthUser initials for avatar
    expect(getByText("T")).toBeInTheDocument();
  });

  test("calls onSignOut when sign out button is clicked", () => {
    const { container } = render(
      <SideDock 
        activeModule="standby" 
        setModule={mockSetModule} 
        authUser={mockAuthUser}
        onSignOut={mockOnSignOut}
      />
    );
    
    // Find the logout icon/button
    const signOutBtn = container.querySelector("button[title='Sign out']");
    expect(signOutBtn).toBeInTheDocument();
    fireEvent.click(signOutBtn!);
    expect(mockOnSignOut).toHaveBeenCalled();
  });
});
