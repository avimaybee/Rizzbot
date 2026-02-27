import { expect, test, describe, spyOn } from "bun:test";
import { render, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { TherapistChat } from "./TherapistChat";

// Mock services
// @ts-ignore
import * as geminiService from "../services/geminiService";
// @ts-ignore
import * as dbService from "../services/dbService";

// Simple mocks
spyOn(geminiService, "streamTherapistAdvice").mockImplementation(() => Promise.resolve("session-id"));
spyOn(dbService, "getTherapistSessions").mockImplementation(() => Promise.resolve([]));
spyOn(dbService, "getMemories").mockImplementation(() => Promise.resolve([]));
spyOn(dbService, "saveTherapistSession").mockImplementation(() => Promise.resolve({}));

describe("TherapistChat", () => {
    test("renders welcome message", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        expect(getByText("Welcome to Therapist Mode")).toBeInTheDocument();
        expect(getByText("What's on your mind today?")).toBeInTheDocument();
    });

    test("renders header with 'Therapist' title", () => {
        const { getByText, getAllByText } = render(<TherapistChat onBack={() => {}} />);
        const titles = getAllByText("Therapist");
        expect(titles.length).toBeGreaterThan(0);
    });

    test("renders the sidebar component on desktop", () => {
        const { getByText } = render(<TherapistChat onBack={() => {}} />);
        // The sidebar has "Archive" as a monospaced accent
        expect(getByText("Archive")).toBeInTheDocument();
    });

    test("can type in the input field", () => {
        const { getByPlaceholderText } = render(<TherapistChat onBack={() => {}} />);
        const input = getByPlaceholderText("Share what's on your mind...");
        fireEvent.change(input, { target: { value: "Hello" } });
        // @ts-ignore
        expect(input.value).toBe("Hello");
    });
});
