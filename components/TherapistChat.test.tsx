import { expect, test, describe, spyOn, mock, beforeEach } from "bun:test";
import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import React from "react";
import { TherapistChat } from "./TherapistChat";

// Mock services
// @ts-ignore
import * as geminiService from "../services/geminiService";
// @ts-ignore
import * as dbService from "../services/dbService";
import { logger } from "../services/logger";

// Mock geminiService
const mockStream = mock((q, id, img, notes, onChunk, onNotes, onEx, onTool, mem) => {
    onChunk("This is a tactical response. How does this dynamic make you feel?");
    return Promise.resolve("session-id");
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

// Use spyOn for logger
const hapticSpy = spyOn(logger, "triggerHaptic");

describe("TherapistChat", () => {
    beforeEach(() => {
        hapticSpy.mockClear();
        mockStream.mockClear();
        localStorage.clear();
    });

    test("renders welcome message", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText("Welcome to Therapist Mode")).toBeInTheDocument();
    });

    test("renders header with 'RELATIONSHIP THERAPIST' title", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText("RELATIONSHIP THERAPIST")).toBeInTheDocument();
    });

    test("can type in the input field", () => {
        const { getByPlaceholderText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText("DECODE_YOUR_THOUGHTS...");
        fireEvent.change(input, { target: { value: "Hello" } });
        // @ts-ignore
        expect(input.value).toBe("Hello");
    });

    test("renders Tactical Report on desktop", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText("TACTICAL_REPORT")).toBeInTheDocument();
    });

    test("triggers haptic on message send", async () => {
        const { getByPlaceholderText, getByLabelText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText("DECODE_YOUR_THOUGHTS...");
        
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        const sendBtn = getByLabelText("Send message");
        
        await act(async () => {
            fireEvent.click(sendBtn);
        });
        
        expect(hapticSpy).toHaveBeenCalled();
    });

    test("shows suggested prompts after AI response", async () => {
        const { getByPlaceholderText, getByText, findByText, getByLabelText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText("DECODE_YOUR_THOUGHTS...");
        
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        const sendBtn = getByLabelText("Send message");
        
        await act(async () => {
            fireEvent.click(sendBtn);
        });
        
        // Wait for prompts to appear
        const promptLabel = await waitFor(() => getByText("SUGGESTED_FOLLOW_UPS"), { timeout: 2000 });
        expect(promptLabel).toBeInTheDocument();
        
        const promptBtn = await findByText(/How does this dynamic make you feel/i);
        expect(promptBtn).toBeInTheDocument();
    });
});
