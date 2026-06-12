import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import Link from 'next/link';

export const metadata: Metadata = {
  title: pageMetadata.terms.title,
  description: pageMetadata.terms.description,
  alternates: { canonical: pageMetadata.terms.canonical },
  openGraph: {
    title: pageMetadata.terms.title,
    description: pageMetadata.terms.description,
  },
};

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-zinc-500 text-sm font-mono mt-3">
            Last updated: March 31, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">1</span>
              Acceptance of Terms
            </h2>
            <p className="text-sm">
              By accessing or using WinQA (&ldquo;the platform&rdquo;) at winqa.ai, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">2</span>
              Description of Service
            </h2>
            <p className="text-sm">
              WinQA is a free AI testing playground that allows developers and QA professionals to compare AI model responses, run code, track bugs and hallucinations, manage test cases, and build a prompt engineering knowledge base. The platform connects to third-party AI providers using API keys you supply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">3</span>
              Acceptable Use
            </h2>
            <p className="text-sm mb-3">You agree not to:</p>
            <ul className="space-y-2 ml-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Use the platform for any unlawful purpose or to violate any applicable laws</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Attempt to gain unauthorized access to the platform, other user accounts, or connected systems</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Use the code execution lab to run malicious code, cryptocurrency miners, or denial-of-service attacks</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Interfere with or disrupt the platform or servers connected to the platform</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Scrape, crawl, or harvest data from the platform in an automated manner beyond normal use</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Generate content that is illegal, harmful, threatening, abusive, or violates the terms of the connected AI providers</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">4</span>
              API Keys & Your Responsibility
            </h2>
            <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/[0.03]">
              <p className="text-sm">
                You are responsible for the security and proper use of any API keys you provide to WinQA. While we encrypt your keys using AES-256-GCM, you acknowledge that:
              </p>
              <ul className="space-y-2 mt-3 ml-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>You have authorization to use the API keys you provide</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>Any API usage costs incurred through WinQA are your responsibility</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>You should use keys with appropriate spending limits and permissions</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>You can remove your keys from the platform at any time via Settings</span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">5</span>
              Service Availability
            </h2>
            <p className="text-sm">
              WinQA is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not guarantee uninterrupted or error-free operation. The platform may experience downtime for maintenance, updates, or circumstances beyond our control. We reserve the right to modify, suspend, or discontinue any part of the service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">6</span>
              Intellectual Property
            </h2>
            <div className="space-y-3 text-sm">
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">Your Content</h3>
                <p>
                  You retain ownership of all content you create on WinQA, including prompts, test cases, bug reports, insights, and code snippets. By using the platform, you grant us a limited license to store and display your content to you within the platform.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">AI-Generated Content</h3>
                <p>
                  Responses generated by AI models through the platform are subject to the terms of the respective AI providers (Cohere, Google, Groq, OpenRouter). WinQA does not claim ownership of AI-generated outputs.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">Platform</h3>
                <p>
                  The WinQA platform, including its design, code, and branding, is the property of WinQA. You may not copy, modify, or distribute the platform without permission.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">7</span>
              Limitation of Liability
            </h2>
            <p className="text-sm">
              To the maximum extent permitted by law, WinQA and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, revenue, or profits, arising from your use of the platform. This includes any costs incurred from AI provider API usage, data loss, or service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">8</span>
              Third-Party Services
            </h2>
            <p className="text-sm">
              WinQA integrates with third-party AI providers and services. Your use of these services through WinQA is also subject to their respective terms of service and privacy policies. We are not responsible for the actions, content, or policies of any third-party service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">9</span>
              Termination
            </h2>
            <p className="text-sm">
              We reserve the right to suspend or terminate your access to WinQA at our discretion, with or without notice, for conduct that we believe violates these Terms or is harmful to other users or the platform. You may stop using the platform at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">10</span>
              Changes to These Terms
            </h2>
            <p className="text-sm">
              We may update these Terms from time to time. Changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date. Your continued use of WinQA after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">11</span>
              Contact
            </h2>
            <p className="text-sm">
              For questions about these Terms of Service, please open an issue on our{' '}
              <a
                href="https://github.com/Ranb972/WinQA"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-400 underline underline-offset-4"
              >
                GitHub repository
              </a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <Link href="/" className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono">
            winqa.ai
          </Link>
          <Link href="/privacy" className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono">
            &larr; Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
