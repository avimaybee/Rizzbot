# Specification: Auth & System Overhaul

**Overview**
Redesign the core system screens (Authentication and Loading) to match the new "Tactical & Organic" aesthetic. The goal is to create a seamless, premium entry experience into the app using glassmorphism and minimal, high-quality animations.

**Functional Requirements**
- **Glassmorphic Auth Modal:** Redesign the `AuthModal` as a glassmorphic container with soft blurs, semi-transparent backgrounds, and organic edges. Use monospaced accents for all form labels and status messages.
- **Minimal Pulse Loading Screen:** Replace the current busy loading screen with a "Minimal Pulse" design. Feature a central pulsing node or percentage indicator surrounded by subtle, monospaced "System Log" entries that appear as it loads.
- **Auth Haptic Feedback:** Integrate haptic feedback for all auth interactions, including a successful "Access Granted" pulse and a distinct error shake on failure.
- **HUD System Accents:** Apply the monospaced design system to all system messages, error alerts, and loading phrases.

**Non-Functional Requirements**
- **Accessibility:** Ensure the glassmorphic modal maintains high contrast and readability for all users.
- **Performance:** Optimize blurs and animations to ensure zero frame drops during the initial boot sequence.

**Acceptance Criteria**
- The Auth modal feels "organic" and premium with its glassmorphic effect and monospaced typography.
- The Loading screen is clean and focused, with a pulsing central element.
- Haptic feedback provides tactile confirmation of all system-level actions.
- Errors are displayed in a tactical, monospaced alert box.

**Out of Scope**
- Changing the Firebase authentication logic or providers.
- Adding a "Social Sign-in" (beyond the existing Google auth).
