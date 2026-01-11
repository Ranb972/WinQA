# WinQA - Your AI Testing Playground

A platform for QA professionals to practice and learn AI testing.

## 🎯 Overview

WinQA provides an interactive environment where QA professionals can develop, practice, and refine their skills in testing AI systems, particularly Large Language Models (LLMs).

## ✨ Features

### 💬 Chat Lab
Test and experiment with LLM prompts in an interactive environment. Explore how different prompts affect AI responses and learn to identify potential issues.

### 🧪 Test Cases
A curated library of test scenarios designed specifically for AI systems. Use these scenarios to understand common AI behaviors, edge cases, and failure modes.

### 🐛 Bug Log
Document and track AI failures and issues. Keep a record of unexpected behaviors, hallucinations, and other problems for analysis and learning.

### 📚 Prompt Library
Access examples of problematic prompts alongside their fixed versions. Learn from real-world cases what makes prompts effective or problematic.

### 💡 Insights
Discover learnings and improvements from testing experiences. Share knowledge and best practices with the QA community.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Ranb972/WinQA.git
   cd WinQA
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 📁 Project Structure

```
WinQA/
├── app/                  # Next.js App Router pages
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility functions
│   └── utils.ts          # Helper utilities
├── public/               # Static assets
└── ...config files
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is private and not licensed for public use.

---

Built with ❤️ for QA professionals exploring AI testing
