import { expect, test, describe, spyOn, mock, beforeEach } from "bun:test";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { TherapistChat } from "./TherapistChat";

// Mock services
// @ts-ignore
import * as geminiService from "../services/geminiService";
// @ts-ignore
import * as dbService from "../services/dbService";
import { logger } from "../services/logger";

// Simple mocks
const mockStream = spyOn(geminiService, "streamTherapistAdvice").mockImplementation(
    (q, id, img, notes, onChunk, onNotes, onEx, onTool, mem) => {
        onChunk("This is a tactical response. How does this dynamic make you feel?");
        return Promise.resolve("session-id");
    }
);
spyOn(dbService, "getTherapistSessions").mockImplementation(() => Promise.resolve([]));
spyOn(dbService, "getMemories").mockImplementation(() => Promise.resolve([]));
spyOn(dbService, "saveTherapistSession").mockImplementation(() => Promise.resolve({}));

// Mock logger.triggerHaptic
const hapticMock = spyOn(logger, "triggerHaptic").mockImplementation(() => {});

describe("TherapistChat", () => {
    beforeEach(() => {
        hapticMock.mockClear();
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
        expect(getByText("SYSTEM_STATUS")).toBeInTheDocument();
    });

    test("triggers haptic on message send", async () => {
        const { getByPlaceholderText, getByRole } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText("DECODE_YOUR_THOUGHTS...");
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        
        // Find send button (it's a button with an SVG)
        const sendBtn = input.parentElement?.querySelector('button:last-child');
        fireEvent.click(sendBtn!);
        
        expect(hapticMock).toHaveBeenCalledWith('light');
    });

    test("shows suggested prompts after AI response", async () => {
        const { getByPlaceholderText, getByText, findByText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText("DECODE_YOUR_THOUGHTS...");
        fireEvent.change(input, { target: { value: "I feel stuck" } });
        
        const sendBtn = input.parentElement?.querySelector('button:last-child');
        fireEvent.click(sendBtn!);
        
        // Wait for streaming to finish and prompts to appear
        const prompt = await findByText(/How does this dynamic make you feel/i);
        expect(prompt).toBeInTheDocument();
        expect(getByText("SUGGESTED_FOLLOW_UPS")).toBeInTheDocument();
    });
});
