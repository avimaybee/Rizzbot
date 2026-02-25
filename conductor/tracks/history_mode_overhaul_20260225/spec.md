# Specification: History Mode Overhaul

**Overview**
Redesign the History Mode into a visually rich "Tactical Gallery" that makes past insights easily searchable and actionable. The goal is to move away from a simple list and create a grid of cards that summarize the "Mission Outcome" of each session.

**Functional Requirements**
- **Visual Gallery Cards:** Replace the list items with rich, organic cards. Each card should display the session mode (icon/badge), a headline, a ghost risk metric, and a "Resume" button.
- **Tactical Search & Mode Filter:** Implement a persistent, monospaced search bar at the top of the history log. Include filter chips to quickly narrow down by Mode (Quick, Practice, Therapist).
- **Session Resumption:** Add a clear "Resume Session" action for Practice and Therapist sessions, allowing users to jump back into previous conversation flows.
- **HUD Metric Accents:** Use monospaced typography and status-color backgrounds (Emerald for low risk, Red for high risk) for all session metrics.
- **Haptic Scrolling:** Integrate haptic feedback when scrolling past "High Risk" entries or selecting a session to view.

**Non-Functional Requirements**
- **Performance:** Efficiently handle large histories with virtualization or pagination to ensure the gallery remains smooth.
- **Layout Consistency:** Ensure the detail view matches the "Tactical Report" aesthetic used in other overhauled modes.

**Acceptance Criteria**
- The History view displays a grid (on desktop) or list (on mobile) of rich cards with monospaced accents.
- Users can filter sessions by mode using a tactical chip interface.
- "Resume Session" takes the user directly back to the relevant mode with the session state restored.
- All timestamps and metrics use the `font-mono` design system.

**Out of Scope**
- Exporting history to external formats (PDF/CSV).
- Batch deleting sessions (individual delete remains).
