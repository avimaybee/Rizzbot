import { expect, test, describe } from "bun:test";
import { render, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { SuggestedPrompts } from "./SuggestedPrompts";

describe("SuggestedPrompts", () => {
    const mockPrompts = [
        "Tell me more about this pattern",
        "How can I set a boundary here?",
        "What should I say next?"
    ];

    test("renders nothing when isVisible is false", () => {
        const { queryByText } = render(
            <SuggestedPrompts 
                prompts={mockPrompts} 
                onSelect={() => {}} 
                isVisible={false} 
            />
        );

        expect(queryByText(mockPrompts[0])).not.toBeInTheDocument();
    });

    test("renders prompts when isVisible is true", () => {
        const { getByText } = render(
            <SuggestedPrompts 
                prompts={mockPrompts} 
                onSelect={() => {}} 
                isVisible={true} 
            />
        );

        expect(getByText(mockPrompts[0])).toBeInTheDocument();
        expect(getByText(mockPrompts[1])).toBeInTheDocument();
        expect(getByText(mockPrompts[2])).toBeInTheDocument();
    });

    test("calls onSelect when a prompt is clicked", () => {
        let selected = "";
        const { getByText } = render(
            <SuggestedPrompts 
                prompts={mockPrompts} 
                onSelect={(p) => { selected = p; }} 
                isVisible={true} 
            />
        );

        fireEvent.click(getByText(mockPrompts[1]));
        expect(selected).toBe(mockPrompts[1]);
    });
});
