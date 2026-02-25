# Specification: Practice Mode Overhaul

**Overview**
Redesign the Practice Mode (Simulator) to provide a more immersive and tactical roleplay experience. The overhaul will replace the blocky, high-contrast UI with the project's new "Tactical & Organic" aesthetic and introduce real-time risk assessment.

**Functional Requirements**
- **UI Makeover:** Apply "Fluid & Organic" layouts (rounded containers, soft shadows) and "Monospaced Accents" for all technical data and HUD elements.
- **Real-time Ghost Risk HUD:** Implement a persistent, dynamic "Ghost Risk" meter in the chat view that updates after each exchange, providing immediate feedback on the conversation's health.
- **Mission Debrief (Tactical Report):** Redesign the post-simulation analysis view as a "Mission Debrief." Use a monospaced, structured report format to present the Simp Coefficient, Vibe Match, and Strategic Advice.
- **Haptic Alerts:** Add haptic feedback for "High Risk" message predictions and successful "Strategic Move" copies.
- **Persona Selection Redesign:** Improve the "Practice Partners" sidebar with a cleaner, more organized look, emphasizing the persona's traits and tactical difficulty (Harshness Level).

**Non-Functional Requirements**
- **Mobile Responsiveness:** Ensure the 2-column desktop chat/analysis layout collapses gracefully into a single-column view that prioritizes the chat while keeping the risk meter visible.
- **Performance:** Real-time risk meter updates should be smooth and not block the chat flow.

**Acceptance Criteria**
- The simulation interface feels like a "Tactical Command Center" with monospaced labels and status indicators.
- The "Ghost Risk" meter is clearly visible during the simulation.
- The "Mission Debrief" presents analysis in a clear, monospaced grid/report format.
- Haptic feedback triggers on mobile during key simulation moments.

**Out of Scope**
- Changing the underlying Gemini persona generation logic.
- Adding multiplayer support.
