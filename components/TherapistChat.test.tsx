import { expect, test, describe, spyOn, mock, beforeEach } from "bun:test";

// Mock services MUST be before importing the component
// Mock geminiService
const mockStream = mock(async (q, id, img, notes, onChunk, onNotes, onEx, onTool, mem) => {
    console.log("Mock Stream called");
    onChunk("How does this dynamic make you feel?");
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
import { logger } from "../services/logger";

describe("TherapistChat", () => {
    beforeEach(() => {
        mockStream.mockClear();
        localStorage.clear();
    });

    test("renders welcome message", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText(/Welcome to Therapist Mode/i)).toBeInTheDocument();
    });

    test("renders header with 'RELATIONSHIP_ANALYST' title", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText(/RELATIONSHIP_ANALYST/i)).toBeInTheDocument();
    });

    test("can type in the input field", () => {
        const { getByPlaceholderText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText(/SUPPLY_OPERATIONAL_METADATA/i);
        fireEvent.change(input, { target: { value: "Hello" } });
        // @ts-ignore
        expect(input.value).toBe("Hello");
    });

    test("renders Tactical Report on desktop", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText(/TACTICAL_REPORT/i)).toBeInTheDocument();
    });

    test("shows suggested prompts after AI response", async () => {
        const { getByPlaceholderText, getByText, findByText, getByLabelText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText(/SUPPLY_OPERATIONAL_METADATA/i);
        
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        const sendBtn = getByLabelText(/Send message/i);
        
        await act(async () => {
            fireEvent.click(sendBtn);
        });
        
        // Wait for streaming to finish and prompts to appear
        const promptLabel = await waitFor(() => getByText(/Suggested_Continuations/i), { timeout: 10000 });
        expect(promptLabel).toBeInTheDocument();
        
        const promptBtn = await findByText(/How does this dynamic make you feel/i);
        expect(promptBtn).toBeInTheDocument();
    }, 15000);
});
