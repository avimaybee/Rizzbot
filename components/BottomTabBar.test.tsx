import "../tests/setup";
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
    
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Quick")).toBeInTheDocument();
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(screen.getByText("Talk")).toBeInTheDocument();
    expect(screen.getByText("Log")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  test("calls onTabChange when a tab is clicked", () => {
    let selectedTab = "quick";
    const onTabChange = (id: string) => { selectedTab = id; };
    
    render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    const simTab = screen.getByText("Sim").parentElement;
    if (simTab) fireEvent.click(simTab);
    
    expect(selectedTab).toBe("simulator");
  });

  test("highlights the active tab", () => {
    const onTabChange = (id: string) => {};
    const { rerender } = render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    const quickTab = screen.getByText("Quick").parentElement;
    expect(quickTab).toHaveClass("text-white");

    rerender(<BottomTabBar activeTab="simulator" onTabChange={onTabChange} />);
    const simTab = screen.getByText("Sim").parentElement;
    expect(simTab).toHaveClass("text-white");
  });
});
