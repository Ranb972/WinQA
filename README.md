# WinQA - AI Testing Platform

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)
![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square&logo=clerk)

A comprehensive platform for QA professionals to test, compare, and document AI model behaviors. Test prompts across multiple LLM providers, track bugs, build a prompt library, and document insights—all in one place.

---

## Screenshots

> *Screenshots coming soon*

<!-- Add your screenshots here:
![Dashboard](./screenshots/dashboard.png)
![Chat Lab](./screenshots/chat-lab.png)
![Settings](./screenshots/settings.png)
-->

---

## Features

### Chat Lab
Interactive testing environment for LLM prompts with powerful comparison capabilities.

- **Single Model Mode** - Test prompts against one model at a time
- **Compare Mode** - Side-by-side comparison of multiple models simultaneously
- **Real-time Responses** - Watch responses stream in with response time tracking
- **Intelligent Fallback** - Automatic retry with alternative models if rate limited
- **Markdown Rendering** - Full markdown support with syntax highlighting for code
- **Bug Reporting** - Flag problematic responses directly from the chat interface
- **Custom Providers** - Add your own OpenAI-compatible API providers

### Test Cases
Organize and manage your AI testing scenarios.

- Create, edit, and delete test cases
- Define expected outcomes for validation
- Run tests directly in Chat Lab with one click
- Track test case descriptions and initial prompts

### Bug Log
Document and track AI failures for analysis and learning.

- **Status Tracking** - Open, Investigating, Resolved
- **Severity Levels** - Low, Medium, High
- **Issue Types** - Hallucination, Formatting, Refusal, Logic
- **Context Preservation** - Captures prompt and response automatically
- **User Notes** - Add additional observations

### Prompt Library
Learn from examples of problematic prompts and their improvements.

- Side-by-side bad vs. good prompt comparison
- Explanations for why improvements work
- Tagging system for organization
- Favorite prompts for quick access

### Insights
Document learnings and best practices from testing experiences.

- Rich markdown content support
- Tagging for categorization
- Timestamp tracking for updates

### Settings & Configuration
Full control over your API keys and model preferences.

- **Per-Provider API Keys** - Bring your own keys for higher rate limits
- **Model Selection** - Choose specific models for each provider
- **Custom Providers** - Add up to 6 OpenAI-compatible APIs (OpenAI, Anthropic, Mistral, etc.)
- **Key Validation** - Test your API keys before saving
- **Secure Storage** - All keys encrypted with AES-256-GCM

---

## LLM Providers

### Built-in Providers

| Provider | Models | Free Tier |
|----------|--------|-----------|
| **Cohere** | Command A (Latest), Command R+, Command R | Yes |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash | Yes |
| **Groq** | Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B | Yes |
| **OpenRouter** | DeepSeek R1, Llama 3 8B, Phi-3 Mini (all free) | Yes |

### Custom Provider Support

Add any OpenAI-compatible API as a custom provider:

| Provider | Base URL | Header Type |
|----------|----------|-------------|
| OpenAI | `https://api.openai.com/v1` | Bearer |
| Anthropic | `https://api.anthropic.com/v1` | x-api-key |
| Mistral | `https://api.mistral.ai/v1` | Bearer |
| Together AI | `https://api.together.xyz/v1` | Bearer |
| Fireworks AI | `https://api.fireworks.ai/inference/v1` | Bearer |
| Perplexity | `https://api.perplexity.ai` | Bearer |

### Intelligent Fallback System

WinQA automatically handles rate limits and errors:

1. **Within-Provider Fallback** - Tries alternative models from the same provider
2. **Cross-Provider Fallback** - Falls back to other providers: Groq → Gemini → OpenRouter → Cohere
3. **Transparent Tracking** - Shows which model was actually used if fallback occurred

---

## Tech Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.1.2 | React framework with App Router |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |

### UI & Styling
| Technology | Purpose |
|------------|---------|
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Radix-based UI components |
| Framer Motion | Animations and transitions |
| Lucide React | Icon library |

### Backend & Data
| Technology | Purpose |
|------------|---------|
| MongoDB Atlas | Database (via Mongoose) |
| Clerk | Authentication & user management |

### LLM SDKs
| SDK | Provider |
|-----|----------|
| cohere-ai | Cohere |
| @google/generative-ai | Google Gemini |
| groq-sdk | Groq |
| Native fetch | OpenRouter & Custom providers |

### Utilities
| Package | Purpose |
|---------|---------|
| react-markdown | Markdown rendering |
| remark-gfm | GitHub Flavored Markdown |
| Web Crypto API | AES-256-GCM encryption |

---

## Security Features

### API Key Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with 100,000 iterations + SHA-256
- **Storage**: Client-side only (localStorage), never sent to WinQA servers
- **Masking**: Keys displayed as `••••••••xxxx` (last 4 chars visible)

### Data Privacy
- API keys encrypted before storage using your unique user ID
- Custom provider credentials use the same encryption
- All LLM requests go directly to providers, not through WinQA backend

---

## Database Schema

### TestCase
```
title, description, initial_prompt, expected_outcome, created_at
```

### BugReport
```
prompt_context, model_response, model_used, issue_type, severity, user_notes, status, created_at
```

### PromptLibrary
```
title, bad_prompt_example, good_prompt_example, explanation, tags, is_favorite, created_at
```

### Insight
```
title, content, tags, created_at, updated_at
```

---

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- MongoDB Atlas account (free tier works)
- Clerk account (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ranb972/WinQA.git
   cd WinQA
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file:
   ```env
   # Required
   MONGODB_URI=mongodb+srv://...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...

   # Optional (shared keys available as fallback)
   COHERE_API_KEY=
   GOOGLE_GEMINI_API_KEY=
   GROQ_API_KEY=
   OPENROUTER_API_KEY=
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**

### Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `COHERE_API_KEY` | No | Cohere API key |
| `GOOGLE_GEMINI_API_KEY` | No | Google AI Studio API key |
| `GROQ_API_KEY` | No | Groq API key |
| `OPENROUTER_API_KEY` | No | OpenRouter API key |

---

## Project Structure

```
WinQA/
├── app/
│   ├── api/
│   │   ├── chat/              # LLM chat endpoint
│   │   ├── bugs/              # Bug report CRUD
│   │   ├── prompts/           # Prompt library CRUD
│   │   ├── insights/          # Insights CRUD
│   │   ├── test-cases/        # Test case CRUD
│   │   ├── stats/             # Dashboard statistics
│   │   ├── test-key/          # API key validation
│   │   └── test-custom-provider/  # Custom provider testing
│   ├── chat-lab/              # Chat Lab page
│   ├── test-cases/            # Test Cases page
│   ├── bugs/                  # Bug Log page
│   ├── prompts/               # Prompt Library page
│   ├── insights/              # Insights page
│   ├── settings/              # Settings page
│   ├── layout.tsx             # Root layout with Clerk
│   ├── page.tsx               # Home/Dashboard
│   └── globals.css            # Global styles
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── Navbar.tsx             # Navigation bar
│   ├── ChatInterface.tsx      # Chat Lab interface
│   ├── ChatMessage.tsx        # Message display
│   ├── ModelSelector.tsx      # Model selection UI
│   ├── BugReportModal.tsx     # Bug reporting modal
│   ├── CustomProviderCard.tsx # Custom provider card
│   └── CustomProviderModal.tsx # Custom provider form
├── lib/
│   ├── llm/
│   │   ├── index.ts           # Main LLM interface
│   │   ├── types.ts           # Type definitions
│   │   ├── models.ts          # Model configurations
│   │   ├── fallback.ts        # Fallback logic
│   │   ├── cohere.ts          # Cohere integration
│   │   ├── gemini.ts          # Gemini integration
│   │   ├── groq.ts            # Groq integration
│   │   ├── openrouter.ts      # OpenRouter integration
│   │   └── custom.ts          # Custom provider handler
│   ├── crypto.ts              # AES-256-GCM encryption
│   ├── api-keys.ts            # API key management
│   ├── custom-providers.ts    # Custom provider storage
│   ├── model-preferences.ts   # Model preference storage
│   └── mongodb.ts             # Database connection
├── models/                    # Mongoose schemas
├── hooks/                     # Custom React hooks
└── middleware.ts              # Clerk auth middleware
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send chat messages to LLM providers |
| GET/POST | `/api/test-cases` | List/Create test cases |
| PUT/DELETE | `/api/test-cases` | Update/Delete test cases |
| GET/POST | `/api/bugs` | List/Create bug reports |
| PUT/DELETE | `/api/bugs` | Update/Delete bug reports |
| GET/POST | `/api/prompts` | List/Create prompts |
| PUT/DELETE | `/api/prompts` | Update/Delete prompts |
| GET/POST | `/api/insights` | List/Create insights |
| PUT/DELETE | `/api/insights` | Update/Delete insights |
| GET | `/api/stats` | Get dashboard statistics |
| POST | `/api/test-key` | Validate API key |
| POST | `/api/test-custom-provider` | Test custom provider connection |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Roadmap

- [ ] Export test results to CSV/JSON
- [ ] Prompt templates
- [ ] Team collaboration features
- [ ] Automated test scheduling
- [ ] Response diff visualization
- [ ] Cost tracking per provider

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is private and not licensed for public use.

---

<p align="center">
  Built with care for QA professionals exploring AI testing
</p>
