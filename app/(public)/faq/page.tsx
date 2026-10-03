import type { Metadata } from 'next';
import Link from 'next/link';
import { faqs, buildFaqJsonLd } from '@/lib/faq-content';

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

const jsonLd = buildFaqJsonLd(faqs);

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
