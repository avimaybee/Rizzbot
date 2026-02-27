# Specification: Therapist Mode Overhaul

**Overview**
Redesign and stabilize the Therapist Mode (TherapistChat) to align with the new "Tactical & Organic" design system. The goal is to transform the current "mock" feature into a polished, high-utility tool for deep-dive conversation analysis, while maintaining the existing AI persona.

**Functional Requirements**
- **UI Makeover:** Replace existing styling with "Fluid & Organic" layouts (soft edges, organic spacing) and "Monospaced Accents" (labels, status badges, reports).
- **Tactical Analysis Panel:** Rebrand the "Analysis" and "Memories" panels into a single, cohesive "Tactical Report" interface. Use monospaced typography for high-density data.
- **Progressive Suggested Prompts:** Implement a "Suggested Prompts" feature that reveals 2-3 tactical follow-up questions at the bottom of the chat after an AI response.
- **Haptic Feedback:** Integrate subtle haptic pulses for sending messages, receiving insights, and interacting with exercises.
- **Stabilization:** Fix existing bugs in message streaming and session history persistence (as reported by the user).
- **Mobile UX:** Replace the complex "Draggable Sheet" with a simpler, more robust "Insight Overlay" or a dedicated tabbed view for mobile users to access analysis without cluttering the chat.

**Non-Functional Requirements**
- **Persona Preservation:** The AI's voice and behavior (Gemini service integration) must remain unchanged.
- **Performance:** Ensure smooth scrolling in long chat sessions and fast transitions between desktop/mobile views.

**Acceptance Criteria**
- The chat interface uses `font-mono` for labels and `font-sans` for main messages, consistent with the project's new style.
- Haptic feedback is detectable on mobile when copying advice or sending messages.
- Suggested prompts appear after the AI finishes typing and disappear when a new message is sent.
- The analysis panel is readable on small screens without breaking the layout.

**Out of Scope**
- Changing the AI therapist's personality or core prompt logic.
- Adding a voice-chat feature.
