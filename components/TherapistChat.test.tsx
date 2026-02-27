import { expect, test, describe, mock, beforeEach } from "bun:test";
import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import React from "react";
import { TherapistChat } from "./TherapistChat";

// Mock services
// @ts-ignore
import * as geminiService from "../services/geminiService";
// @ts-ignore
import * as dbService from "../services/dbService";

// Direct mock for logger
const mockTriggerHaptic = mock(() => {});
mock.module("../services/logger", () => ({
  logger: {
    triggerHaptic: mockTriggerHaptic,
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  }
}));

// Mock geminiService
const mockStream = mock(async (q, id, img, notes, onChunk, onNotes, onEx, onTool, mem) => {
    // Provide a prompt-inducing chunk
    onChunk("How does this make you feel? What do you want to do next?");
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

describe("TherapistChat", () => {
    beforeEach(() => {
        mockTriggerHaptic.mockClear();
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

    test("triggers haptic on message send", async () => {
        const { getByPlaceholderText, getByLabelText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText(/SUPPLY_OPERATIONAL_METADATA/i);
        
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        const sendBtn = getByLabelText(/Send message/i);
        
        await act(async () => {
            fireEvent.click(sendBtn);
        });
        
        expect(mockTriggerHaptic).toHaveBeenCalled();
    });

    test("shows suggested prompts after AI response", async () => {
        const { getByPlaceholderText, getByText, findByText, getByLabelText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText(/SUPPLY_OPERATIONAL_METADATA/i);
        
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        const sendBtn = getByLabelText(/Send message/i);
        
        await act(async () => {
            fireEvent.click(sendBtn);
        });
        
        // Wait for prompts to appear
        const promptLabel = await waitFor(() => getByText(/PROPOSED_TRANSMISSIONS/i), { timeout: 3000 });
        expect(promptLabel).toBeInTheDocument();
        
        const promptBtn = await findByText(/How does this make you feel/i);
        expect(promptBtn).toBeInTheDocument();
    });
});
