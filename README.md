<div align="center">

# ⚔️ WinQA

**AI Testing Playground — compare models, run battles, catch hallucinations**

[![Live Site](https://img.shields.io/badge/live-winqa.ai-f97316?style=for-the-badge)](https://winqa.ai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Ranb972/WinQA?style=for-the-badge&color=facc15)](https://github.com/Ranb972/WinQA/stargazers)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06b6d4?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47a248?style=for-the-badge&logo=mongodb)](https://mongodb.com)

</div>

![WinQA hero](public/images/screenshots/landing-hero.jpg)

---

## What is WinQA

I got tired of flipping between four browser tabs trying to figure out which model was lying to me. WinQA sends the same prompt to Cohere, Gemini, Groq, and Mistral at once, lets you pit them against each other in structured challenges, and gives you somewhere to keep notes when one of them breaks in an interesting way. Run it locally, or poke at the live version at [winqa.ai](https://winqa.ai).

---

## Features

### Chat Lab & Compare Mode

Fire one prompt at four models at the same time. See who answered first, who hedged, who made stuff up, and who actually got it right — all side by side.

![Chat Lab](public/images/screenshots/chat-lab.jpg)

### AI Battle Arena — 9 challenges

Two models go head to head in nine formats: Escalation, The Interrogation, Chinese Whispers, The Build-Up, Code Duel (both models run their answers live), ASCII Artist, Emoji Story, The Blindfold, and Battle Royale. Pick winners, watch a leaderboard form, revisit the matchups that surprised you.

![Battle Arena](public/images/screenshots/battle.jpg)

### Code Testing Lab

Write JavaScript, TypeScript, or Python in the editor and hit run. Or ask an AI to write it for you and check if it actually runs. Code runs on third-party runners (Judge0 CE, with the Piston public API and, when configured, Judge0 via RapidAPI as fallbacks) through the server, output lands below the editor, and there's a "what worked?" analysis when you want a second opinion.

![Code Testing](public/images/screenshots/code-testing.jpg)

### Bug Log & Prompt Library

The Bug Log is where you write down the times AI failed at something real: hallucinations, lazy refusals, broken logic, weird formatting. Tag it, save the exact prompt, come back later. The Prompt Library is its twin for the things that worked — before/after rewrites so you remember why version 3 beat version 1.

### Test Cases & Insights

Test Cases is a library of scenarios you keep reusing to probe models. Insights is a notebook for the stuff you figured out while testing: patterns, workarounds, and whatever surprised you enough to write down.

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes, MongoDB Atlas, Mongoose |
| Auth | Clerk (Google + GitHub OAuth) |
| LLM Providers | Cohere, Google Gemini, Groq, Mistral (Ministral 3) |
| Code Execution | Judge0 CE, Judge0 via RapidAPI, Piston public API |
| Security | HSTS and CSP headers; saved API keys are stored encrypted (AES-256-GCM) with a server-side key ring and never returned to the browser |
| Deployment | Vercel |

---

## Getting Started

```bash
git clone https://github.com/Ranb972/WinQA.git
cd WinQA
npm install
cp .env.example .env.local
# fill in MongoDB URI, Clerk keys, and (optionally) LLM API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

```env
MONGODB_URI=mongodb+srv://user:password@cluster.xxxxx.mongodb.net/winqa?retryWrites=true&w=majority
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# optional — users can add their own keys in Settings
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_API_KEY=AIzaSyXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Links

- **Live:** [winqa.ai](https://winqa.ai)
- **About:** [winqa.ai/about](https://winqa.ai/about)
- **FAQ:** [winqa.ai/faq](https://winqa.ai/faq)

---

## License

MIT — see [LICENSE](LICENSE).
