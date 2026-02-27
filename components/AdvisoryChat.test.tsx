import { expect, test, describe, spyOn, mock, beforeEach } from "bun:test";

// Mock geminiService
const mockStream = mock(async (q, id, img, notes, onChunk, onNotes, onEx, onTool, mem) => {
    // Simulate streaming
    onChunk("How does this dynamic make you feel?");
    onChunk(" Tell me more about it.");
    return "session-id";
});
mock.module("../services/geminiService", () => ({
  streamTherapistAdvice: mockStream
}));

// Mock dbService
mock.module("../services/dbService", () => ({
  getTherapistSessions: mock(() => Promise.resolve([])),
  getMemories: mock(() => Promise.resolve([])),
  saveTherapistSession: mock(() => Promise.resolve({})),
  saveMemory: mock(() => Promise.resolve({})),
  deleteMemory: mock(() => Promise.resolve({})),
  updateMemory: mock(() => Promise.resolve({}))
}));

import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import React from "react";
import { AdvisoryChat } from "./AdvisoryChat";
import "../tests/setup";

describe("AdvisoryChat", () => {
    beforeEach(() => {
        mockStream.mockClear();
        localStorage.clear();
    });

    test("renders welcome message", () => {
        const { getByText } = render(<AdvisoryChat onBack={() => {}} />);
        expect(getByText(/Advisory Session/i)).toBeTruthy();
    });

    test("renders header title", () => {
        const { getAllByText } = render(<AdvisoryChat onBack={() => {}} />);
        const titles = getAllByText(/Advisory/i);
        expect(titles.length).toBeGreaterThan(0);
    });

    test("can type in the input field", () => {
        const { getByPlaceholderText } = render(<AdvisoryChat onBack={() => {}} />);
        const input = getByPlaceholderText(/Share your thoughts/i);
        fireEvent.change(input, { target: { value: "Hello" } });
        // @ts-ignore
        expect(input.value).toBe("Hello");
    });

    test("renders Session Summary on desktop", () => {
        const { getByText } = render(<AdvisoryChat onBack={() => {}} />);
        expect(getByText(/Session Summary/i)).toBeTruthy();
    });
});
