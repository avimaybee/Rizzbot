# Specification: Professional Modern Refinement

## Objective
Transition the application from a "Dark Tactical Noir" (brutalist/gaming) aesthetic to a "Modern Professional" design language. Every element must be functional and meaningful, removing all decorative "fluff" and "nonsense" references.

## Core Principles
1. **Functional Minimalism:** Remove decorative elements like corner nodes, fake hardware strings, and radar animations.
2. **Professional Clarity:** Use clean typography (Sans-serif) for primary content and navigation. Use Monospace only for technical data.
3. **Refined Palette:** Deep matte backgrounds with subtle, purposeful glassmorphism. Avoid aggressive "Tactical" terminology.
4. **Meaningful Interactions:** Haptic feedback should remain but be subtle. Animations should reflect real system states (e.g., loading data, not "scanning").

## High-Level Changes
- **Typography:** Replace `font-impact` with a more professional sans-serif (e.g., standard sans with bold weights). Reduce usage of `font-mono`.
- **Terminolgy:** "Uplink" -> "Connection", "Dossier" -> "Profile", "Tactical Scanner" -> "Message Analysis", "Practice Node" -> "Conversation Practice".
- **Components:** 
    - Delete `CornerNodes.tsx` and all usages.
    - Redesign `ModuleHeader` to be clean and simple.
    - Remove fake logs from `LoadingScreen` and `StandbyScreen`.
    - Clean up `AuthModal` to look like a professional SaaS entry point.
