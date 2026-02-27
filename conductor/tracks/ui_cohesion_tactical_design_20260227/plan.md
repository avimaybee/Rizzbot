# Implementation Plan: UI/UX Cohesion & Tactical Design System

## Phase 1: Global Utilities & Standardized Components
- [x] Task: Extract and centralize `CornerNodes` into its own file or update the existing one for universal use. (1767241)
- [x] Task: Create a `ModuleHeader` shared component that implements the "Tactical Dossier" layout. (1767241)
- [x] Task: Audit `tailwind.config.js` and `index.css` to ensure all "Fluid & Organic" tokens are globally accessible. (1767241)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Global Utilities' (1767241)

## Phase 2: Theme Alignment & Semantic Colors
- [x] Task: Update `TherapistChat.tsx` to use semantic colors (Amber/Gold for insights, Rose for Alerts only). (552a2f1)
- [x] Task: Update `Simulator.tsx` to align its headers and labels with the Dossier system. (552a2f1)
- [x] Task: Update `History.tsx` list and detail views to use the "Tactical Report" aesthetic. (552a2f1)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Theme Alignment' (552a2f1)

## Phase 3: Module Refactoring
- [x] Task: Refactor `QuickAdvisor.tsx` to use the centralized `ModuleHeader`. (552a2f1)
- [x] Task: Refactor `Simulator.tsx` to use the centralized `ModuleHeader`. (552a2f1)
- [x] Task: Refactor `History.tsx` to use the centralized `ModuleHeader`. (552a2f1)
- [x] Task: Refactor `TherapistChat.tsx` to use the centralized `ModuleHeader`. (552a2f1)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Module Refactoring' (552a2f1)

## Phase 4: Final Polish & Interaction Sync
- [x] Task: Audit all buttons and inputs for consistent use of `soft-edge` and `font-mono`. (552a2f1)
- [x] Task: Sync haptic feedback patterns across all "Save" and "Action" triggers. (552a2f1)
- [x] Task: Refactor `StandbyScreen.tsx` for tactical consistency. (552a2f1)
- [x] Task: Refactor `WellbeingCheckIn.tsx` for tactical consistency. (552a2f1)
- [x] Task: Refactor `SideDock.tsx` for technical consistency (Frames vs Circles). (552a2f1)
- [x] Task: Final review of all screens for spacing and mobile thumb-reachability consistency. (552a2f1)
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Polish' (552a2f1)

**Track Status: COMPLETED**
