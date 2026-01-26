# WinQA - AI Testing Playground

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

An AI Testing Playground designed for QA professionals to test, compare, and document AI/LLM model behaviors. Test prompts across multiple providers, track bugs, build a prompt library, manage test cases, and document insights—all in one comprehensive platform.

## 📸 Screenshots

<!-- Screenshots will be added here -->
```
Coming soon: Dashboard, Chat Lab, and Settings screenshots
```

## ✨ Features

### 🧪 Chat Lab
Test AI models in single or compare mode to evaluate responses side-by-side.

- **Single Model Testing** - Test prompts against individual AI models
- **Compare Mode** - Side-by-side comparison of multiple models simultaneously
- **Real-time Streaming** - Watch responses stream with response time tracking
- **Markdown Support** - Full markdown rendering with syntax highlighting
- **Direct Bug Reporting** - Flag problematic responses directly from chat

### 🧬 Code Testing Lab
Execute and test code with AI assistance for debugging and optimization.

- **Multi-language Support** - Test JavaScript, Python, and more
- **AI Debug Assistance** - Get AI-powered debugging suggestions
- **Interactive Execution** - Run code and see results instantly
- **Model Selection** - Choose different AI models for assistance

### 🐛 Bug Log
Track AI response issues with comprehensive metadata and status management.

- **Severity Levels** - Categorize bugs as Low, Medium, or High
- **Status Tracking** - Open, Investigating, Resolved workflows
- **Issue Types** - Hallucination, Formatting, Refusal, Logic errors
- **Context Preservation** - Automatic capture of prompt and response
- **User Notes** - Add detailed observations and findings

### 📚 Prompt Library
Store and compare good vs bad prompts to learn effective patterns.

- **Side-by-side Comparison** - Bad vs. good prompt examples
- **Detailed Explanations** - Understand why improvements work
- **Tagging System** - Organize prompts by category
- **Favorites** - Quick access to your best prompts

### 📋 Test Cases
Manage reusable testing scenarios for consistent evaluation.

- **Test Case Management** - Create, edit, and organize test scenarios
- **Expected Outcomes** - Define validation criteria
- **One-click Testing** - Run tests directly in Chat Lab
- **Test History** - Track results over time

### 💡 Insights
Document learnings about AI model behaviors and best practices.

- **Rich Markdown Support** - Format your insights beautifully
- **Tagging** - Categorize insights by topic
- **Timestamps** - Track when insights were added or updated
- **Knowledge Base** - Build your AI testing expertise

### ⚙️ Settings
Manage API keys with encryption and export/import your data.

- **Secure API Key Storage** - AES-256-GCM encryption
- **Per-provider Keys** - Bring your own API keys for higher limits
- **Custom Providers** - Add OpenAI-compatible API endpoints
- **Model Preferences** - Select preferred models for each provider
- **Key Validation** - Test API keys before saving
- **Data Export/Import** - Backup and restore your data

## 🛠️ Tech Stack

### Core Framework
- **Next.js 16** - React framework with Turbopack
- **TypeScript** - Type-safe development
- **React 19** - Latest React features

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Animation library
- **Lucide React** - Beautiful icon library

### Backend & Database
- **MongoDB** - NoSQL database via Mongoose ODM
- **Clerk** - Authentication and user management

### AI/LLM Integration
- **Multiple Providers** - Cohere, Google Gemini, Groq, OpenRouter
- **Custom Provider Support** - Add any OpenAI-compatible API
- **Intelligent Fallback** - Automatic retry with alternative models

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **MongoDB Database** - [MongoDB Atlas](https://cloud.mongodb.com) (free tier available)
- **Clerk Account** - [Clerk Dashboard](https://dashboard.clerk.com) (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/winqa.git
   cd winqa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and configure the required variables (see Environment Variables section below).

4. **Configure environment variables**

   Open `.env.local` and update with your credentials:
   - Get Clerk keys from [https://dashboard.clerk.com](https://dashboard.clerk.com)
   - Get MongoDB URI from [https://cloud.mongodb.com](https://cloud.mongodb.com)
   - Optionally add LLM API keys (users can also provide their own in Settings)

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔐 Environment Variables

Reference the `.env.example` file for all available variables.

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for authentication | [Clerk Dashboard](https://dashboard.clerk.com) |
| `CLERK_SECRET_KEY` | Clerk secret key for server-side operations | [Clerk Dashboard](https://dashboard.clerk.com) |
| `MONGODB_URI` | MongoDB connection string | [MongoDB Atlas](https://cloud.mongodb.com) |
| `NEXT_PUBLIC_APP_URL` | Your application URL (e.g., http://localhost:3000) | Your deployment URL |

### Optional Variables (LLM API Keys)

Users can provide their own API keys through the Settings page. Server-side keys act as fallbacks.

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `COHERE_API_KEY` | Cohere API key for Command models | [Cohere Dashboard](https://dashboard.cohere.com/api-keys) |
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API key | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | Groq API key for fast inference | [Groq Console](https://console.groq.com/keys) |
| `OPENROUTER_API_KEY` | OpenRouter API key for multiple models | [OpenRouter](https://openrouter.ai/keys) |
| `JUDGE0_API_KEY` | Judge0 API for code execution (optional) | [RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce) |

## 📜 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Start development server with hot reload |
| Build | `npm run build` | Build optimized production bundle |
| Start | `npm run start` | Start production server |
| Lint | `npm run lint` | Run ESLint to check code quality |

## 🏗️ Project Structure

```
winqa/
├── app/                        # Next.js app directory
│   ├── api/                   # API routes
│   │   ├── chat/              # LLM chat endpoint
│   │   ├── bugs/              # Bug report CRUD
│   │   ├── prompts/           # Prompt library CRUD
│   │   ├── insights/          # Insights CRUD
│   │   ├── test-cases/        # Test case CRUD
│   │   └── stats/             # Dashboard statistics
│   ├── chat-lab/              # Chat Lab page
│   ├── code-lab/              # Code Testing Lab page
│   ├── test-cases/            # Test Cases page
│   ├── bugs/                  # Bug Log page
│   ├── prompts/               # Prompt Library page
│   ├── insights/              # Insights page
│   ├── settings/              # Settings page
│   └── page.tsx               # Dashboard/Home page
├── components/                 # React components
│   ├── ui/                    # Reusable UI components
│   ├── ChatInterface.tsx      # Main chat interface
│   ├── Navbar.tsx             # Navigation bar
│   └── ...                    # Other components
├── lib/                       # Utility functions
│   ├── llm/                   # LLM provider integrations
│   ├── crypto.ts              # Encryption utilities
│   └── mongodb.ts             # Database connection
├── models/                    # MongoDB schemas (Mongoose)
├── hooks/                     # Custom React hooks
└── middleware.ts              # Clerk authentication middleware
```

## 🔒 Security Features

- **Encrypted Storage** - All API keys encrypted with AES-256-GCM
- **Client-side Only** - Keys stored in localStorage, never sent to WinQA servers
- **Direct API Calls** - LLM requests go directly to providers, not through backend
- **Key Masking** - Keys displayed as `••••••••xxxx` in UI

## 📊 Supported AI Providers

### Built-in Providers
- **Cohere** - Command A, Command R+, Command R
- **Google Gemini** - Gemini 2.0 Flash, Gemini 1.5 Pro
- **Groq** - Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B
- **OpenRouter** - DeepSeek R1, Llama 3 8B, Phi-3 Mini

### Custom Provider Support
Add any OpenAI-compatible API:
- OpenAI
- Anthropic
- Mistral
- Together AI
- Fireworks AI
- Perplexity
- And more...

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with care for QA professionals exploring AI testing methodologies.

---

**Note:** This is a testing and documentation tool. Always review AI-generated content before using in production environments.
