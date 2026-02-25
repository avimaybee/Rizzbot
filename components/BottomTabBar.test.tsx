import { expect, test, describe } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
// We'll create the component after the failing test
// @ts-ignore
import BottomTabBar from "./BottomTabBar";

describe("BottomTabBar", () => {
  const mockTabs = [
    { id: 'quick', label: 'Quick Mode' },
    { id: 'practice', label: 'Practice' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' }
  ];

  test("renders all tab labels", () => {
    const onTabChange = (id: string) => {};
    render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    expect(screen.getByText("Quick Mode")).toBeInTheDocument();
    expect(screen.getByText("Practice")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  test("calls onTabChange when a tab is clicked", () => {
    let selectedTab = "quick";
    const onTabChange = (id: string) => { selectedTab = id; };
    
    render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    const practiceTab = screen.getByText("Practice").parentElement;
    if (practiceTab) fireEvent.click(practiceTab);
    
    expect(selectedTab).toBe("practice");
  });

  test("highlights the active tab", () => {
    const onTabChange = (id: string) => {};
    const { rerender } = render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    const quickTab = screen.getByText("Quick Mode").parentElement;
    // We expect some active class like 'text-white' or 'active'
    expect(quickTab).toHaveClass("text-white");

    rerender(<BottomTabBar activeTab="practice" onTabChange={onTabChange} />);
    const practiceTab = screen.getByText("Practice").parentElement;
    expect(practiceTab).toHaveClass("text-white");
  });
});
