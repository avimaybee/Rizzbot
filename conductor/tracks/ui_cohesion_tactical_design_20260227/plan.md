# Implementation Plan: UI/UX Cohesion & Tactical Design System

## Phase 1: Global Utilities & Standardized Components
- [x] Task: Extract and centralize `CornerNodes` into its own file or update the existing one for universal use.
- [x] Task: Create a `ModuleHeader` shared component that implements the "Tactical Dossier" layout.
- [x] Task: Audit `tailwind.config.js` and `index.css` to ensure all "Fluid & Organic" tokens are globally accessible.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Global Utilities'

## Phase 2: Theme Alignment & Semantic Colors
- [x] Task: Update `TherapistChat.tsx` to use semantic colors (Amber/Gold for insights, Rose for Alerts only).
- [x] Task: Update `Simulator.tsx` to align its headers and labels with the Dossier system.
- [x] Task: Update `History.tsx` list and detail views to use the "Tactical Report" aesthetic.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Theme Alignment'

## Phase 3: Module Refactoring
- [x] Task: Refactor `QuickAdvisor.tsx` to use the centralized `ModuleHeader`.
- [x] Task: Refactor `Simulator.tsx` to use the centralized `ModuleHeader`.
- [x] Task: Refactor `History.tsx` to use the centralized `ModuleHeader`.
- [x] Task: Refactor `TherapistChat.tsx` to use the centralized `ModuleHeader`.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Module Refactoring'

## Phase 4: Final Polish & Interaction Sync
- [x] Task: Audit all buttons and inputs for consistent use of `soft-edge` and `font-mono`.
- [x] Task: Sync haptic feedback patterns across all "Save" and "Action" triggers.
- [x] Task: Refactor `StandbyScreen.tsx` for tactical consistency.
- [x] Task: Refactor `WellbeingCheckIn.tsx` for tactical consistency.
- [x] Task: Refactor `SideDock.tsx` for technical consistency (Frames vs Circles).
- [x] Task: Final review of all screens for spacing and mobile thumb-reachability consistency.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Polish'

**Track Status: COMPLETED**
