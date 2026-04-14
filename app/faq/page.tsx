import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description:
    'Common questions about WinQA — what it is, how it works, pricing, supported AI models, data privacy, and how to get started.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'FAQ - Frequently Asked Questions',
    description:
      'Common questions about WinQA — what it is, how it works, pricing, supported AI models, data privacy, and how to get started.',
  },
};

const faqs = [
  {
    question: 'What is WinQA?',
    answer:
      'WinQA is a free AI testing playground. You can compare responses from different AI models side by side, run battle challenges between them, execute code live in the browser, and keep a log of every time an AI gets something wrong. It was built by a QA professional who wanted a proper tool for poking at LLMs.',
  },
  {
    question: 'Is WinQA free?',
    answer:
      'Yes, completely free. No subscription, no paywall, no credit card. You bring your own API keys for the AI providers you want to use, and WinQA handles the rest. The providers themselves may charge for API usage, but WinQA never will.',
  },
  {
    question: 'How is WinQA different from ChatGPT?',
    answer:
      'ChatGPT is one AI model you talk to. WinQA lets you test multiple models at once and compare how they respond to the same prompt. You can also battle models against each other, log their failures, run their code, and build a library of what works. Think of it less as a chatbot and more as a testing lab.',
  },
  {
    question: 'What AI models can I test on WinQA?',
    answer:
      'WinQA connects to four providers: Cohere (Command R, Command R+), Google Gemini (Pro, Flash), Groq (Llama, Mixtral with fast inference), and OpenRouter (100+ models through one API). You pick which ones to use and can swap between them anytime.',
  },
  {
    question: 'Do I need my own API keys?',
    answer:
      'Yes. You get API keys directly from each provider — most offer free tiers. Paste them into WinQA settings and they get encrypted with AES-256-GCM before storage. WinQA never sees your keys in plaintext after that. You can delete them anytime from Settings.',
  },
  {
    question: 'What is AI Battle mode?',
    answer:
      'AI Battle has 9 challenge types split across two categories: Mind Games (Escalation, Interrogation, Chinese Whispers, The Build-Up) and Spectacular (Code Duel, ASCII Artist, Emoji Story, The Blindfold, Battle Royale). Each challenge tests a different weakness. In Blindfold mode, you guess which AI wrote which response before the reveal.',
  },
  {
    question: 'How does the Code Testing Lab work?',
    answer:
      'You paste code into the editor and it runs right in your browser. Supports JavaScript, Python, and TypeScript. You see the output immediately — if it errors, you can get AI help debugging it. Useful for testing whether AI-generated code actually works before you trust it.',
  },
  {
    question: 'What programming languages are supported?',
    answer:
      'The Code Testing Lab runs JavaScript, Python, and TypeScript. Code executes in a browser sandbox, so you get instant results without any local setup.',
  },
  {
    question: 'Is my data private and secure?',
    answer:
      'Your data is yours. API keys are encrypted with AES-256-GCM. Authentication goes through Clerk. Everything you create — prompts, bugs, test cases, insights — is tied to your account and only visible to you. WinQA does not sell data. The full details are in the privacy policy.',
  },
  {
    question: 'Is WinQA open source?',
    answer:
      'Yes. The full source code is on GitHub at github.com/Ranb972/WinQA. You can read the code, report bugs, or contribute.',
  },
  {
    question: 'Who built WinQA?',
    answer:
      'Ran, a QA professional turned developer. He built WinQA because he wanted a real tool for testing AI models — not just chatting with them. The name comes from his dog, Win.',
  },
  {
    question: 'How can I give feedback or report a bug?',
    answer:
      'Open an issue on the GitHub repository at github.com/Ranb972/WinQA/issues. Bug reports, feature ideas, complaints — all welcome.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-black text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 min-h-[44px] py-2.5 text-sm text-orange-500/70 hover:text-orange-500 transition-colors font-mono mb-6 sm:mb-8"
          >
            &larr; Back to WinQA
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-mono uppercase tracking-widest">
              Case File
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white font-heading tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-zinc-400 text-base mt-3 leading-relaxed">
            The short answers to the things people actually ask.
          </p>
        </div>

        {/* FAQ items */}
        <div className="space-y-6 text-zinc-300 leading-relaxed">
          {faqs.map((faq, index) => (
            <section key={index}>
              <h2 className="text-lg font-semibold text-white font-heading mb-3 flex items-start gap-3">
                <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono shrink-0 mt-0.5">
                  {index + 1}
                </span>
                {faq.question}
              </h2>
              <div className="ml-11">
                <p className="text-sm">{faq.answer}</p>
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
          >
            winqa.ai
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
            >
              About
            </Link>
            <span className="text-zinc-700">|</span>
            <Link
              href="/privacy"
              className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
            >
              Privacy
            </Link>
            <span className="text-zinc-700">|</span>
            <Link
              href="/terms"
              className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
