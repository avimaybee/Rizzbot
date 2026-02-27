import { expect, test, describe, vi, beforeEach } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { History } from "./History";
import * as dbService from "../services/dbService";

// Mock the dbService
vi.mock("../services/dbService", () => ({
  getSessions: vi.fn(),
  deleteSession: vi.fn(),
}));

describe("History Component Redesign", () => {
  const mockSessions = [
    {
      id: 1,
      mode: 'quick',
      headline: 'Quick Session 1',
      ghost_risk: 45,
      message_count: 2,
      created_at: new Date().toISOString(),
      parsedResult: { vibeCheck: { theirEnergy: 'warm' } }
    },
    {
      id: 2,
      mode: 'simulator',
      headline: 'Practice Session 1',
      ghost_risk: 15,
      message_count: 10,
      created_at: new Date().toISOString(),
      persona_name: 'Emma',
      parsedResult: { analysis: { ghostRisk: 15 } }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders sessions in a visual gallery grid layout", async () => {
    (dbService.getSessions as any).mockResolvedValue({
      sessions: mockSessions,
      pagination: { total: 2, limit: 20, offset: 0, hasMore: false }
    });

    const { getByText } = render(<History firebaseUid="test-user" />);

    // Wait for sessions to load
    await waitFor(() => {
      expect(getByText("Quick Session 1")).toBeInTheDocument();
    });

    // Check for grid layout classes
    const sessionList = getByText("Quick Session 1").closest(".grid");
    expect(sessionList).toBeInTheDocument();
    expect(sessionList).toHaveClass("grid-cols-1");
    expect(sessionList).toHaveClass("sm:grid-cols-2");
  });

  test("renders History Card with correct mode and risk badges", async () => {
    (dbService.getSessions as any).mockResolvedValue({
      sessions: mockSessions,
      pagination: { total: 2, limit: 20, offset: 0, hasMore: false }
    });

    const { getByText } = render(<History firebaseUid="test-user" />);

    await waitFor(() => {
      expect(getByText("Quick Session 1")).toBeInTheDocument();
    });

    const quickCard = getByText("Quick Session 1").closest(".group");
    expect(quickCard).toHaveTextContent("QUICK_MODE");
    expect(quickCard).toHaveTextContent("RISK_45%");

    const practiceCard = getByText("Practice Session 1").closest(".group");
    expect(practiceCard).toHaveTextContent("PRACTICE");
    expect(practiceCard).toHaveTextContent("RISK_15%");
  });

  test("shows image preview when screenshots are available", async () => {
    const sessionWithScreenshot = {
      ...mockSessions[0],
      parsedResult: {
        ...mockSessions[0].parsedResult,
        request: { screenshots: ["data:image/png;base64,mock-screenshot"] }
      }
    };

    (dbService.getSessions as any).mockResolvedValue({
      sessions: [sessionWithScreenshot],
      pagination: { total: 1, limit: 20, offset: 0, hasMore: false }
    });

    const { getByAltText } = render(<History firebaseUid="test-user" />);

    await waitFor(() => {
      const previewImg = getByAltText("Preview");
      expect(previewImg).toBeInTheDocument();
      expect(previewImg).toHaveAttribute("src", "data:image/png;base64,mock-screenshot");
    });
  });

  test("shows fallback icon when no screenshots are available", async () => {
    (dbService.getSessions as any).mockResolvedValue({
      sessions: [mockSessions[0]], // mockSessions[0] has no screenshots in parsedResult
      pagination: { total: 1, limit: 20, offset: 0, hasMore: false }
    });

    const { container, getByText } = render(<History firebaseUid="test-user" />);

    await waitFor(() => {
      expect(getByText("Quick Session 1")).toBeInTheDocument();
    });

    // Check for Zap icon (Lucide icon renders as an SVG)
    const svg = container.querySelector("svg.lucide-zap");
    expect(svg).toBeInTheDocument();
  });
});
