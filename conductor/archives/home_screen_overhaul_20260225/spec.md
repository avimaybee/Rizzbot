# Specification: Home Screen Overhaul

**Overview**
Transform the Home Screen (StandbyScreen) into a sleek, "Minimalist Zen" dashboard that serves as a high-utility command center. The redesign will move away from large, blocky buttons toward an elegant interface with tactical nodes and refined visuals.

**Functional Requirements**
- **Minimalist Zen UI:** Implement a clean, spacious layout using "Fluid & Organic" principles. Use subtle gradients, soft shadows, and refined abstract visuals that give the app a premium, high-tech feel.
- **Instant Scan Node:** Add a prominent "Instant Scan" tactical button on the Home screen. This should trigger an immediate file upload/screenshot analysis flow, bypassing sub-menus.
- **Tactile Mode Switchers:** Redesign the primary mode entries (Quick, Practice, Therapist) as tactile cards or nodes. Each should provide haptic feedback and use monospaced accents for metadata (e.g., // STATUS: ACTIVE, // LAST SESSION: 2H AGO).
- **User Dossier Preview:** Include a small, monospaced "Dossier Preview" or "Identity Node" that summarizes the user's current style profile traits (e.g., Chill, Minimalist).
- **Onboarding Checklist Integration:** For new or incomplete profiles, display the "Tactical Onboarding Checklist" directly on the Home dashboard to encourage completion.

**Non-Functional Requirements**
- **Visual Polish:** Use high-performance CSS animations for background decor (e.g., pulsing nodes, scanning lines) that do not impact main thread performance.
- **Mobile optimization:** Ensure the "Instant Scan" action is easily reachable with one thumb on mobile devices.

**Acceptance Criteria**
- The Home screen feels sleek and "Zen-like," with a clear focus on the "Instant Scan" and "Mode Switchers."
- Haptic feedback is detectable on all primary navigation nodes.
- All labels and status lines use the monospaced design system.
- The UI gracefully adapts to whether a user has a style profile or not.

**Out of Scope**
- Changing the app's global navigation (BottomTabBar).
- Adding a news or social feed to the home screen.
