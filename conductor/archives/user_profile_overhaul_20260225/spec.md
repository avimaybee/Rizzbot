# Specification: User Profile Overhaul

**Overview**
Redesign the User Profile into a "Tactical Dossier" that provides a deep, visual understanding of the user's texting identity. This track will maintain the current "Voice Training" flow but modernize the frontend and introduce new visual metrics for style analysis.

**Functional Requirements**
- **Tactical Dossier UI:** Redesign the profile review screen as a monospaced dossier. Use structured data blocks, monospaced accents, and status-colored confidence scores.
- **Voice Visualizer:** Implement a visual "Style Radar" or graph that illustrates the user's primary traits (e.g., Slang Intensity, Emoji Frequency, Tone Warmth, Punctuation Strictness).
- **System Settings Hub:** Consolidate all account-level actions (Sign Out, Data Sync, Account Privacy) into a cohesive "System Settings" panel within the dossier.
- **Onboarding Progress Checklist:** Add a tactical checklist to the profile intro screen to guide users through completing their profile (e.g., [x] Voice Samples, [ ] Style Preferences, [ ] Persona Sync).
- **Voice Training UI Cleanup:** Refactor the quiz/sample collection interface to use the "Fluid & Organic" design, ensuring it feels less like a form and more like a tactical briefing.

**Non-Functional Requirements**
- **Layout Consistency:** Ensure the dossier aesthetic matches the "Tactical Report" used in other modes.
- **Haptic feedback:** Provide tactile confirmation when saving profile changes or completing onboarding steps.

**Acceptance Criteria**
- The profile review screen uses `font-mono` for all data and `font-sans` for descriptions.
- The "Style Radar" visualizer correctly reflects the user's selected or AI-extracted traits.
- The onboarding checklist updates in real-time as sections are completed.
- Account actions are easily accessible within the monospaced settings hub.

**Out of Scope**
- Changing the underlying Gemini style extraction logic.
- Adding social features (e.g., sharing profiles).
