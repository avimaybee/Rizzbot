import { expect, test, describe } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { AdvisorySummary } from "./AdvisorySummary";
import "../tests/setup";

describe("AdvisorySummary", () => {
    const mockNotes = {
        keyThemes: ["Theme 1", "Theme 2"],
        userInsights: ["Insight 1"],
        actionItems: ["Action 1"],
        attachmentStyle: "secure" as const,
        emotionalState: "Calm",
        relationshipDynamic: "Healthy"
    };

    const mockMemories = [
        { id: 1, content: "Global memory", type: "GLOBAL" as const },
        { id: 2, content: "Session memory", type: "SESSION" as const }
    ];

    test("renders correctly with data", () => {
        const { getByText } = render(
            <AdvisorySummary
                clinicalNotes={mockNotes}
                memories={mockMemories}
                onUpdateMemory={() => {}}
                onDeleteMemory={() => {}}
            />
        );

        expect(getByText(/Session Summary/i)).toBeTruthy();
        expect(getByText(/Theme 1/i)).toBeTruthy();
        expect(getByText(/Action 1/i)).toBeTruthy();
        expect(getByText(/Global memory/i)).toBeTruthy();
        expect(getByText(/Session memory/i)).toBeTruthy();
    });

    test("renders empty states correctly", () => {
        const emptyNotes = {
            keyThemes: [],
            userInsights: [],
            actionItems: [],
            attachmentStyle: "unknown" as const,
        };

        const { getByText } = render(
            <AdvisorySummary
                clinicalNotes={emptyNotes}
                memories={[]}
                onUpdateMemory={() => {}}
                onDeleteMemory={() => {}}
            />
        );

        expect(getByText(/Establishing data points/i)).toBeTruthy();
        expect(getByText(/Observations will appear/i)).toBeTruthy();
        expect(getByText(/Awaiting session context/i)).toBeTruthy();
    });
});
