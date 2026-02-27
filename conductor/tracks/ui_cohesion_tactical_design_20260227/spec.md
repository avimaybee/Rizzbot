# Specification: UI/UX Cohesion & Tactical Design System

**Overview**
The RizzBot has evolved through several rapid tracks. This has led to "design debt" where different modules use slightly different interpretations of the "Tactical Intelligence" aesthetic. This track will consolidate all UI elements into a single, cohesive design system that emphasizes high-contrast data, monospaced accents, and "Fluid & Organic" layouts.

**Functional Requirements**
- **Universal CornerNodes:** Consolidate all local `CornerNodes` components into a single, shared utility component.
- **Dossier Header System:** Standardize all module headers to use the `TACTICAL_MODE // ID: 123` layout first introduced in the User Profile.
- **Semantic Color Mapping:** Standardize accent colors across all modules:
  - `hard-gold`: Profile, Personalization, High-value Insights.
  - `hard-blue`: Action, Active Sessions, Scanning.
  - `hard-red/rose`: Analysis, Risk, Termination, Alerts.
  - `emerald-400`: Success, Verification, Safe Status.
- **Tactical Micro-copy:** Audit and replace standard labels (e.g., "History") with tactical equivalents (e.g., "HISTORY_LOG", "BREACH_DETECTION").
- **Component Consistency:** Ensure all buttons, inputs, and cards use the `soft-edge` (organic) utility and `font-mono` for all metadata.

**Acceptance Criteria**
- All 5 modules (Quick, Practice, Therapist, History, Profile) share identical header structures.
- No local `CornerNodes` definitions remain in screen files.
- Accent colors are semantically consistent (e.g., no `rose` for non-risk therapist elements).
- All modules use the "Dossier" styling for secondary data (metadata, status lines).

**Out of Scope**
- Changing the backend logic for any module.
- Introducing new functional features.
- Modifying the landing page (AuthModal).
