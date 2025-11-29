<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Rizzbot - Your AI Wingman for Texting

Your AI-powered texting coach that helps you craft the perfect responses.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```

2. Set up your API key:
   - Copy `.env.local.example` to `.env.local`
   - Add your Gemini API key: `VITE_GEMINI_API_KEY=your_key_here`
   - Get your API key from https://makersuite.google.com/app/apikey

3. Run the app:
   ```
   npm run dev
   ```

## Deploy to Cloudflare Pages

When deploying, make sure to set the environment variable `VITE_GEMINI_API_KEY` in your Cloudflare Pages dashboard under Settings > Environment variables.
