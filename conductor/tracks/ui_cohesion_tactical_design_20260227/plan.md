# Implementation Plan: UI/UX Cohesion & Tactical Design System

## Phase 1: Global Utilities & Standardized Components
- [~] Task: Extract and centralize `CornerNodes` into its own file or update the existing one for universal use.
- [ ] Task: Create a `ModuleHeader` shared component that implements the "Tactical Dossier" layout.
- [ ] Task: Audit `tailwind.config.js` and `index.css` to ensure all "Fluid & Organic" tokens are globally accessible.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Global Utilities'

## Phase 2: Theme Alignment & Semantic Colors
- [ ] Task: Update `TherapistChat.tsx` to use semantic colors (Amber/Gold for insights, Rose for Alerts only).
- [ ] Task: Update `Simulator.tsx` to align its headers and labels with the Dossier system.
- [ ] Task: Update `History.tsx` list and detail views to use the "Tactical Report" aesthetic.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Theme Alignment'

## Phase 3: Module Refactoring
- [ ] Task: Refactor `QuickAdvisor.tsx` to use the centralized `ModuleHeader`.
- [ ] Task: Refactor `Simulator.tsx` to use the centralized `ModuleHeader`.
- [ ] Task: Refactor `History.tsx` to use the centralized `ModuleHeader`.
- [ ] Task: Refactor `TherapistChat.tsx` to use the centralized `ModuleHeader`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Module Refactoring'

## Phase 4: Final Polish & Interaction Sync
- [ ] Task: Audit all buttons and inputs for consistent use of `soft-edge` and `font-mono`.
- [ ] Task: Sync haptic feedback patterns across all "Save" and "Action" triggers.
- [ ] Task: Final review of all screens for spacing and mobile thumb-reachability consistency.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Polish'
