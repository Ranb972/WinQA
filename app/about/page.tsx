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
      'Compare responses from multiple AI models side-by-side. Switch providers mid-conversation and see who gives the best answer.',
  },
  {
    icon: Swords,
    title: 'AI Battle Arena',
    description:
      '9 challenge types across Mind Games and Spectacular categories. Escalation, Interrogation, Code Duel, Blindfold, Battle Royale, and more.',
  },
  {
    icon: Code,
    title: 'Code Testing Lab',
    description:
      'Execute AI-generated code in real-time. JavaScript, Python, and TypeScript with live output and AI-powered debugging.',
  },
  {
    icon: Bug,
    title: 'Bug Log',
    description:
      'Document every hallucination, logic error, and formatting failure. Tag by category, track severity, and link bugs to the prompts that caused them.',
  },
  {
    icon: Library,
    title: 'Prompt Library',
    description:
      'Save and organize effective prompts. Learn techniques like Chain of Thought, Few-Shot, and more. Copy-paste ready.',
  },
  {
    icon: TestTube2,
    title: 'Test Cases',
    description:
      'Create reusable test scenarios for systematic AI evaluation. Run every model through the same trial.',
  },
  {
    icon: Lightbulb,
    title: 'Insights',
    description:
      'Record patterns in AI behavior. Map which models excel in which domains and build your knowledge base over time.',
  },
];

const providers = [
  { name: 'Cohere', description: 'Command R and Command R+ models' },
  { name: 'Google Gemini', description: 'Gemini Pro and Gemini Flash' },
  { name: 'Groq', description: 'Ultra-fast inference with Llama and Mixtral' },
  {
    name: 'OpenRouter',
    description: 'Access to 100+ models through a single API',
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
            className="inline-flex items-center gap-2 text-sm text-orange-500/70 hover:text-orange-500 transition-colors font-mono mb-8"
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
            The AI testing playground for QA professionals, developers, and anyone curious about how AI models really perform.
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
                WinQA is a free AI testing playground where you can compare AI models side-by-side, pit them against each other in battle challenges, execute code in real-time, document hallucinations and failures, and build a structured knowledge base of prompt engineering techniques. Think of it as a QA lab purpose-built for interrogating AI.
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
                WinQA was created by{' '}
                <span className="text-white">Ran</span>, a QA professional
                turned developer. It was born from the intersection of QA
                expertise and AI curiosity &mdash; the same instinct that makes
                you poke at software until it breaks, applied to large language
                models.
              </p>
              <p className="text-sm">
                The name? Named after his dog,{' '}
                <span className="text-white">Win</span>. Because every good
                investigation needs a loyal companion.
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
                Making AI testing accessible to everyone. Whether you&apos;re a
                QA professional stress-testing models before production, a
                developer evaluating which LLM fits your use case, or just
                someone curious about how AI models actually perform &mdash;
                WinQA gives you the tools to test, compare, and document
                everything you find. No paywalls, no credit card required.
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
              Have feedback, a feature request, or found a bug in the platform
              itself? Open an issue on the{' '}
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
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
          >
            winqa.ai
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
            >
              Privacy
            </Link>
            <span className="text-zinc-700">|</span>
            <Link
              href="/terms"
              className="text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
