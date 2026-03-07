# Rizzbot 🚀
**The Intel-Driven AI Wingman & Emotional Intelligence Texting Coach.**

[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini_Flash-4285F4?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Deployed on Cloudflare](https://img.shields.io/badge/Edge-Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)

Rizzbot is a sophisticated texting assistant designed to help bridge the gap between "what to say" and "how to say it authentically." Built for the real-world complexities of modern dating and communication, Rizzbot uses **research-backed psychology** and **advanced Gemini intelligence** to help you communicate with confidence, clarity, and your own unique voice.

---

## 🏛️ Core Methodology
Unlike generic "rizz" generators, Rizzbot is built on foundational behavioral psychology principles:

*   **Investment Balance:** Analyzes message volume and timing to track who is carrying the conversation.
*   **Reciprocity Mirroring:** Teaches you how to match energy levels (length, tone, style) to build rapport.
*   **The Peak-End Rule:** Optimizes openers and "exit lines" for maximum impact.
*   **Attachment Awareness:** Informs responses based on discovered communication patterns.

---

## 🔥 Key Features

### ⚡ Quick Mode (Tactical Intelligence)
Upload a screenshot or paste a message for immediate, context-aware advice.
*   **Vision-Aware OCR:** Automatically extracts messages, detects platform delivery status (Read/Delivered), and identifies UI elements.
*   **The Vibe Check:** Real-time analysis of their energy (Cold/Warm/Hot) and explicit interest level (0-100%).
*   **5-Style Generation:** Get suggestions ranging from **Smooth** and **Bold** to **Witty** and **Your Style** (mimicking your personal profile).
*   **Psychology-Backed "Pro-Tips":** Insights on *why* a suggestion works, not just what to send.

### 🎯 Practice Mode (Behavioral Simulator)
Trial your messages in a dynamic, high-fidelity practice dojo.
*   **Persona Architect:** Build detailed AI personas based on context, screenshots, or descriptions.
*   **Dynamic Behavioral States:** Simulated targets track cumulative **Mood** (Intrigued, Defensive, etc.) and **Familiarity** over time.
*   **Multi-Bubble Pacing:** Messages are delivered in staggered, natural intervals to replicate real-life texting patterns.
*   **Session Debriefs:** End-of-session reports with Ghost Risk assessments and tactical advice.

### 🧠 Relationship Therapist (Deep Dive)
A specialist mode for uncovering relationship blind spots and attachment patterns.
*   **Clinical Notes Dashboard:** Real-time tracking of attachment styles, key themes, and emotional states.
*   **Masterclass Exercises:** Interactive assignments (Boundary Builder, Needs Assessment) assigned by the AI.
*   **Kill-Switch:** Dedicated safety resources for identifying and navigating unhealthy dynamics.

### 👤 My Voice (AI Voice Mirroring)
Teach Rizzbot how *you* actually text so it never sounds like a bot.
*   **Style Extraction:** Analyzes your raw message samples to extract quirks in capitalization, punctuation, and emoji usage.
*   **Signature Patterns:** Captures your specific slang and openers to ensure "elevated authenticity."

---

## 🛠️ Technical Stack
*   **Frontend:** React 19, TypeScript, Vite.
*   **Styling:** Modern Vanilla CSS + Tailwind CSS utilities.
*   **AI Engine:** Google Gemini SDK (`gemini-3-flash-preview`).
*   **Infrastructure:** Cloudflare Pages (Hosting) + Cloudflare Workers (API Layer).
*   **AI Architecture:** Multi-tier Model Fallback (Flash Lite → Flash → Pro) with automated `retryWithBackoff` (Exponential/Jitter).
*   **Storage:** Cloudflare D1 (SQLite) for high-performance session persistence.
*   **Authentication:** Firebase Auth (Email/Google).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Gemini API Key
- Cloudflare Wrangler (for local development)

### Installation
1.  **Clone the Repo**
    ```bash
    git clone https://github.com/avimaybee/DeadOrGhosting.git
    cd DeadOrGhosting
    ```
2.  **Install Dependencies**
    ```bash
    npm install
    ```
3.  **Environment Setup**
    Create a `.env` or set up Wrangler secrets for:
    - `GEMINI_API_KEY`
    - Firebase project credentials

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## 🗺️ Roadmap
- [x] **Phase 5:** Relationship Therapist & Clinical Notes Dashboard.
- [x] **Phase 7:** Insights Dashboard & PWA Share Handler integration.
- [x] **Service Hardening:** Multi-tier fallback, JSON resilience, and restored therapist context.
- [ ] **Phase 8:** ML-driven wellbeing detection & long-term progress tracking.

---

## 🛡️ Safety & Ethics
Rizzbot is designed to enhance **authentic connection**, not manipulation. We prioritize user wellbeing through:
- **Safety Interventions:** Automated detection of abusive or dangerous patterns.
- **Wellbeing Check-ins:** Proactive prompts during high-frequency or late-night usage.
- **Ethical Content Policy:** No generation of harassment or non-consensual content.

---

**Made for the ones who care enough to send the perfect text.** 🥂