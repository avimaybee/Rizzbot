import { expect, test, describe } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
// @ts-ignore
import BottomTabBar from "./BottomTabBar";

describe("BottomTabBar", () => {
  test("renders all tab labels", () => {
    const onTabChange = (id: string) => {};
    const { getByText } = render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    expect(getByText("Home")).toBeInTheDocument();
    expect(getByText("Quick")).toBeInTheDocument();
    expect(getByText("Sim")).toBeInTheDocument();
    expect(getByText("Talk")).toBeInTheDocument();
    expect(getByText("Log")).toBeInTheDocument();
    expect(getByText("You")).toBeInTheDocument();
  });

  test("calls onTabChange when a tab is clicked", () => {
    let selectedTab = "quick";
    const onTabChange = (id: string) => { selectedTab = id; };
    
    const { getByText } = render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    const simTab = getByText("Sim").parentElement;
    if (simTab) fireEvent.click(simTab);
    
    expect(selectedTab).toBe("simulator");
  });

  test("highlights the active tab", () => {
    const onTabChange = (id: string) => {};
    const { getByText, rerender } = render(<BottomTabBar activeTab="quick" onTabChange={onTabChange} />);
    
    const quickTab = getByText("Quick").parentElement;
    expect(quickTab).toHaveClass("text-white");

    rerender(<BottomTabBar activeTab="simulator" onTabChange={onTabChange} />);
    const simTab = getByText("Sim").parentElement;
    expect(simTab).toHaveClass("text-white");
  });
});
