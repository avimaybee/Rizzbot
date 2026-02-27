import { expect, test, describe } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { TherapistTacticalReport } from "./TherapistTacticalReport";
import { ClinicalNotes, TherapistMemory } from "../types";

describe("TherapistTacticalReport", () => {
    const mockNotes: ClinicalNotes = {
        attachmentStyle: 'anxious',
        keyThemes: ["Trust Issues", "Pattern Recognition"],
        emotionalState: 'Reflective',
        actionItems: ["Practice boundaries", "Notice projection"],
        userInsights: []
    };

    const mockMemories: TherapistMemory[] = [
        { id: 1, type: 'GLOBAL', content: 'Core memory text', created_at: new Date().toISOString() },
        { id: 2, type: 'SESSION', content: 'Session memory text', created_at: new Date().toISOString() }
    ];

    test("renders tactical report sections", () => {
        const { getByText } = render(
            <TherapistTacticalReport 
                clinicalNotes={mockNotes} 
                memories={mockMemories}
                onUpdateMemory={() => {}}
                onDeleteMemory={() => {}}
            />
        );

        expect(getByText("TACTICAL_REPORT")).toBeInTheDocument();
        expect(getByText("SYSTEM_STATUS")).toBeInTheDocument();
        expect(getByText("DETECTION_LOG")).toBeInTheDocument();
        expect(getByText("USER_CONTEXT")).toBeInTheDocument();
    });

    test("renders emotional state and attachment style", () => {
        const { getByText } = render(
            <TherapistTacticalReport 
                clinicalNotes={mockNotes} 
                memories={mockMemories}
                onUpdateMemory={() => {}}
                onDeleteMemory={() => {}}
            />
        );

        expect(getByText("EMOTIONAL_STATE")).toBeInTheDocument();
        expect(getByText("Reflective")).toBeInTheDocument();
        expect(getByText("ATTACHMENT_STYLE")).toBeInTheDocument();
        expect(getByText("anxious")).toBeInTheDocument();
    });

    test("renders themes and insights", () => {
        const { getByText } = render(
            <TherapistTacticalReport 
                clinicalNotes={mockNotes} 
                memories={mockMemories}
                onUpdateMemory={() => {}}
                onDeleteMemory={() => {}}
            />
        );

        expect(getByText("Trust Issues")).toBeInTheDocument();
        expect(getByText("Pattern Recognition")).toBeInTheDocument();
        expect(getByText("Practice boundaries")).toBeInTheDocument();
        expect(getByText("Notice projection")).toBeInTheDocument();
    });

    test("renders memories", () => {
        const { getByText } = render(
            <TherapistTacticalReport 
                clinicalNotes={mockNotes} 
                memories={mockMemories}
                onUpdateMemory={() => {}}
                onDeleteMemory={() => {}}
            />
        );

        expect(getByText("Core memory text")).toBeInTheDocument();
        expect(getByText("Session memory text")).toBeInTheDocument();
    });
});
