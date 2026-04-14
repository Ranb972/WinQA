import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FlaskConical,
  Swords,
  Code,
  Bug,
  Library,
  TestTube2,
  Lightbulb,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About WinQA',
  description:
    'WinQA is an AI testing playground for comparing LLM models side-by-side, running battle challenges, testing code, documenting AI failures, and building prompt engineering knowledge.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About WinQA',
    description:
      'WinQA is an AI testing playground for comparing LLM models side-by-side, running battle challenges, testing code, documenting AI failures, and building prompt engineering knowledge.',
  },
};

const features = [
  {
    icon: FlaskConical,
    title: 'Chat Lab',
    description:
      'Ask the same question to multiple models and see the answers next to each other. You can swap providers mid-conversation to see how a different model picks up the thread.',
  },
  {
    icon: Swords,
    title: 'AI Battle Arena',
    description:
      '9 challenges split between Mind Games and Spectacular. Escalation, Interrogation, Code Duel, Blindfold, Battle Royale — each one designed to expose a different weakness.',
  },
  {
    icon: Code,
    title: 'Code Testing Lab',
    description:
      'Paste AI-generated code and run it right in the browser. JavaScript, Python, TypeScript. See the output, see the errors, get AI help debugging.',
  },
  {
    icon: Bug,
    title: 'Bug Log',
    description:
      'When an AI hallucinates or gives you broken logic, log it here. Tag the type, note the severity, link it back to the prompt that triggered it.',
  },
  {
    icon: Library,
    title: 'Prompt Library',
    description:
      'Keep your best prompts in one place. Chain of Thought, Few-Shot, whatever works for you. Everything is ready to copy and reuse.',
  },
  {
    icon: TestTube2,
    title: 'Test Cases',
    description:
      'Write a test once, then run every model through it. Same input, different models, compare the output.',
  },
  {
    icon: Lightbulb,
    title: 'Insights',
    description:
      'Gemini nails code but fumbles jokes? Write it down. Over time you build a map of what each model is actually good at.',
  },
];

const providers = [
  { name: 'Cohere', description: 'Command R and Command R+ models' },
  { name: 'Google Gemini', description: 'Gemini Pro and Gemini Flash' },
  { name: 'Groq', description: 'Fast inference — Llama and Mixtral' },
  {
    name: 'OpenRouter',
    description: '100+ models, one API',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-slate-100">
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
            About WinQA
          </h1>
          <p className="text-zinc-400 text-base mt-3 leading-relaxed">
            A place to poke, prod, and stress-test AI models until they crack.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-zinc-300 leading-relaxed">
          {/* 1. What is WinQA */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                1
              </span>
              What is WinQA
            </h2>
            <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <p className="text-sm">
                You ask two AI models the same question, and one of them confidently gives you the wrong answer. Now what? WinQA lets you run that kind of experiment on purpose — compare models head to head, battle them against each other, execute their code live, and log every failure you find. It&apos;s a QA lab for AI.
              </p>
            </div>
          </section>

          {/* 2. What You Can Do */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                2
              </span>
              What You Can Do
            </h2>
            <div className="space-y-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-orange-500" />
                      </div>
                      <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider">
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-sm">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Tech Highlights */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                3
              </span>
              Under the Hood
            </h2>
            <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/[0.03] mb-4">
              <p className="text-sm font-medium text-white mb-3">
                4 LLM Providers Connected
              </p>
              <div className="space-y-2">
                {providers.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between px-4 py-2.5 bg-black/30 border border-white/[0.04] rounded"
                  >
                    <span className="text-white/70 text-sm">
                      {provider.name}
                    </span>
                    <span className="text-orange-500/60 text-xs font-mono">
                      {provider.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>
                  Real-time code execution in the browser for JavaScript,
                  Python, and TypeScript
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>
                  A/B voting system inspired by{' '}
                  <span className="text-white">LM Arena</span> (formerly
                  Chatbot Arena) for blind model comparison
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>
                  API keys encrypted with{' '}
                  <span className="text-white font-mono">AES-256-GCM</span>{' '}
                  &mdash; never stored in plaintext
                </span>
              </li>
            </ul>
          </section>

          {/* 4. The Story */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                4
              </span>
              The Story
            </h2>
            <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <p className="text-sm mb-3">
                WinQA was built by{' '}
                <span className="text-white">Ran</span>. He started in QA,
                moved into development, and kept the QA habit — that itch
                to poke at things until they break. When LLMs showed up, he
                pointed that itch at AI.
              </p>
              <p className="text-sm">
                The name comes from his dog,{' '}
                <span className="text-white">Win</span>. Every investigation
                needs a sidekick.
              </p>
            </div>
          </section>

          {/* 5. The Mission */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                5
              </span>
              The Mission
            </h2>
            <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/[0.03]">
              <p className="text-sm">
                Most AI testing happens in private Slack threads and scattered
                notebooks. WinQA puts it all in one place — the tests, the
                results, the failures, the stuff you figured out along the way.
                It&apos;s free. No paywall, no credit card, no catch.
              </p>
            </div>
          </section>

          {/* 6. Open Source */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                6
              </span>
              Open Source
            </h2>
            <p className="text-sm">
              WinQA is open source. Browse the code, report issues, or
              contribute on{' '}
              <a
                href="https://github.com/Ranb972/WinQA"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-400 underline underline-offset-4"
              >
                GitHub
              </a>
              .
            </p>
          </section>

          {/* 7. Contact & Feedback */}
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">
                7
              </span>
              Contact &amp; Feedback
            </h2>
            <p className="text-sm">
              Something broken? Got an idea? Want to complain? Open an issue on
              the{' '}
              <a
                href="https://github.com/Ranb972/WinQA/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-400 underline underline-offset-4"
              >
                GitHub issue tracker
              </a>
              .
            </p>
          </section>
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
