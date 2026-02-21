# Rizzbot - Your AI Wingman for Texting

Your AI-powered texting coach that helps you craft authentic, confident responses.

## Features

- **🚀 Quick Mode:** Upload screenshots or paste messages for instant advice
- **🧠 Relationship Therapist:** Deep-dive AI persona for uncovering relationship blind spots
- **🎯 Practice Mode:** Simulate conversations with AI personas before sending
- **📜 History:** Review past sessions with full context
- **👤 Your Style:** AI learns your unique texting voice
- **🔥 Vibe Check:** Instant analysis of their energy and interest level
- **🎨 New Branding**: Professional organic AI-generated logo and aesthetic integration

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env.local` file with:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Deploy to Cloudflare Pages

1. Push to GitHub
2. Connect repo to Cloudflare Pages
3. Set environment variables in Pages dashboard
4. Configure D1 database binding (`RIZZBOT_DATA`)
5. Run migrations:
   ```bash
   npx wrangler d1 migrations apply RIZZBOT_DATA --remote
   ```

See [Deployment Guide](./docs/05_DEPLOYMENT.md) for details.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **AI:** Google Gemini API (gemini-3-flash-preview)
- **Auth:** Firebase Authentication
- **Database:** Cloudflare D1 (SQLite)
- **Hosting:** Cloudflare Pages

## Documentation

- [Product Vision](./docs/01_PRODUCT_VISION.md)
- [Style & Voice Guide](./docs/02_STYLE_AND_VOICE.md)
- [Development Status](./docs/03_DEVELOPMENT_STATUS.md)
- [Technical Specs](./docs/04_TECHNICAL_SPECS.md)
- [Deployment Guide](./docs/05_DEPLOYMENT.md)
- [Testing & Bugs](./docs/06_TESTING_AND_BUGS.md)
