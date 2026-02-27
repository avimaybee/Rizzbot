import { expect, test, describe, spyOn } from "bun:test";
import { render, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { TherapistSidebar } from "./TherapistSidebar";
import { TherapistSession } from "../services/dbService";

// Clean up after each test
// (Not strictly necessary with Bun's test runner, but good practice)
// afterEach(() => { cleanup(); });

describe("TherapistSidebar", () => {
    const mockSessions: TherapistSession[] = [
        {
            interaction_id: "session-1",
            messages: [{ role: 'user', content: 'test', timestamp: Date.now() }],
            clinical_notes: { keyThemes: ["Trust Issues"] },
            created_at: new Date().toISOString()
        },
        {
            interaction_id: "session-2",
            messages: [{ role: 'user', content: 'hello', timestamp: Date.now() }],
            clinical_notes: { keyThemes: ["Pattern Recognition"] },
            created_at: new Date().toISOString()
        }
    ];

    test("renders correctly with sessions", () => {
        const { getByText, queryByText } = render(
            <TherapistSidebar
                sessions={mockSessions}
                currentInteractionId="session-1"
                onNewSession={() => { }}
                onLoadSession={() => { }}
                onBack={() => { }}
            />
        );

        expect(getByText("Archive")).toBeInTheDocument();
        expect(getByText("New Analysis")).toBeInTheDocument();
        expect(getByText("Previous Logs")).toBeInTheDocument();
        expect(getByText("Trust Issues")).toBeInTheDocument();
        expect(getByText("Pattern Recognition")).toBeInTheDocument();
    });

    test("shows empty state when no sessions", () => {
        const { getByText } = render(
            <TherapistSidebar
                sessions={[]}
                onNewSession={() => { }}
                onLoadSession={() => { }}
                onBack={() => { }}
            />
        );

        expect(getByText("No logs found")).toBeInTheDocument();
    });

    test("calls onNewSession when button clicked", () => {
        let clicked = false;
        const { getByText } = render(
            <TherapistSidebar
                sessions={[]}
                onNewSession={() => { clicked = true; }}
                onLoadSession={() => { }}
                onBack={() => { }}
            />
        );

        fireEvent.click(getByText("New Analysis"));
        expect(clicked).toBe(true);
    });

    test("highlights active session", () => {
        const { getByText } = render(
            <TherapistSidebar
                sessions={mockSessions}
                currentInteractionId="session-1"
                onNewSession={() => { }}
                onLoadSession={() => { }}
                onBack={() => { }}
            />
        );

        const activeSessionText = getByText("Trust Issues");
        const activeContainer = activeSessionText.closest('button');
        expect(activeContainer).toHaveClass("bg-rose-500/10");
        expect(activeContainer).toHaveClass("border-rose-500/30");

        const inactiveSessionText = getByText("Pattern Recognition");
        const inactiveContainer = inactiveSessionText.closest('button');
        expect(inactiveContainer).not.toHaveClass("bg-rose-500/10");
        expect(inactiveContainer).toHaveClass("bg-zinc-900/30");
    });

    test("calls onLoadSession when a session is clicked", () => {
        let selectedId = "";
        const { getByText } = render(
            <TherapistSidebar
                sessions={mockSessions}
                onNewSession={() => { }}
                onLoadSession={(s) => { selectedId = s.interaction_id; }}
                onBack={() => { }}
            />
        );

        fireEvent.click(getByText("Pattern Recognition").closest('button')!);
        expect(selectedId).toBe("session-2");
    });
});
