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
import { TherapistChat } from "./TherapistChat";

describe("TherapistChat", () => {
    beforeEach(() => {
        mockStream.mockClear();
        localStorage.clear();
    });

    test("renders welcome message", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText(/Welcome to Therapist Mode|Therapy/i)).toBeInTheDocument();
    });

    test("renders header title", () => {
        const { getAllByText } = render(<TherapistChat onBack={() => {}} />);
        const titles = getAllByText(/Relationship/i);
        expect(titles.length).toBeGreaterThan(0);
    });

    test("can type in the input field", () => {
        const { getByPlaceholderText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText(/Share what's on your mind...|DECODE|SUPPLY/i);
        fireEvent.change(input, { target: { value: "Hello" } });
        // @ts-ignore
        expect(input.value).toBe("Hello");
    });

    test("renders Tactical Report on desktop", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText(/Session Summary|TACTICAL_REPORT/i)).toBeInTheDocument();
    });

    test("shows suggested prompts after AI response", async () => {
        const { getByPlaceholderText, getByText, findByText, getByLabelText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText(/Share what's on your mind...|DECODE|SUPPLY/i);
        
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        const sendBtn = getByLabelText(/Send message/i);
        
        await act(async () => {
            fireEvent.click(sendBtn);
        });
        
        // Wait for prompts
        const promptBtn = await waitFor(() => findByText(/How does this dynamic make you feel/i), { timeout: 5000 });
        expect(promptBtn).toBeInTheDocument();
    }, 10000);
});
