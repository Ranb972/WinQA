import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import Link from 'next/link';

export const metadata: Metadata = {
  title: pageMetadata.privacy.title,
  description: pageMetadata.privacy.description,
  alternates: { canonical: pageMetadata.privacy.canonical },
  openGraph: {
    title: pageMetadata.privacy.title,
    description: pageMetadata.privacy.description,
  },
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-zinc-500 text-sm font-mono mt-3">
            Last updated: October 3, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">1</span>
              Overview
            </h2>
            <p>
              WinQA (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the platform&rdquo;) is an AI testing playground for developers and QA professionals. This Privacy Policy explains how we collect, use, store, and protect your information when you use our platform at winqa.ai.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">2</span>
              Information We Collect
            </h2>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">Account Information</h3>
                <p className="text-sm">
                  We use <span className="text-white">Clerk</span> for authentication. When you sign up, Clerk collects your email address and authentication credentials. We do not store passwords directly — Clerk handles all authentication securely.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">API Keys</h3>
                <p className="text-sm">
                  If you save API keys for AI providers (Cohere, Google Gemini, Groq, Mistral, or a custom provider): Keys you save are stored in our database encrypted with AES-256-GCM under a key held only in our server environment. They are decrypted only on our servers, at the moment a request goes to that provider. They are never sent back to your browser; Settings shows only the last four characters. Removing a key, or deleting your account, deletes it. If a built-in provider rejects your key as unauthorized, WinQA may retry the request once with its shared key; custom providers are not retried. Keys saved in this browser before October 2026 stay there, obfuscated, and are sent to our server over HTTPS with each request that needs them until you move them from Settings; browser storage ends on October 31, 2026.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">User-Generated Content</h3>
                <p className="text-sm">
                  Content you create on the platform — prompts, test cases, bug reports, insights, battle results, and code snippets — is stored in our <span className="text-white">MongoDB</span> database and associated with your user account.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-orange-500 font-mono uppercase tracking-wider mb-2">Usage Analytics</h3>
                <p className="text-sm">
                  We use <span className="text-white">Vercel Analytics</span> to collect anonymous, aggregated usage data such as page views and performance metrics. This data does not personally identify you.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">3</span>
              How We Use Your Information
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>To provide and maintain the WinQA platform and its features</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>To authenticate your identity and secure your account</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>To make API calls to AI providers using the keys you save</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>To store and display your testing data (prompts, bugs, test cases, insights)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>To improve platform performance and user experience</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">4</span>
              Data Storage & Security
            </h2>
            <div className="space-y-3 text-sm">
              <p>Your data is stored in MongoDB and secured with the following measures:</p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>Keys you save are stored in our database encrypted with AES-256-GCM under a key held only in our server environment. They are decrypted only on our servers, at the moment a request goes to that provider. They are never sent back to your browser; Settings shows only the last four characters.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>All connections use HTTPS/TLS encryption in transit</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>Authentication is handled by Clerk with industry-standard security practices</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span>Access to data is restricted to authenticated users viewing their own content</span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">5</span>
              Data Sharing
            </h2>
            <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/[0.03]">
              <p className="text-sm font-medium text-white mb-2">We do not sell your data.</p>
              <p className="text-sm">
                We do not sell, rent, or trade your personal information or content to third parties. Your data is shared only with the following service providers, each for the purpose and with the data listed:
              </p>
              <ul className="space-y-2 mt-3 ml-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Clerk</span> — Account and authentication: your email address and sign-in credentials, and the account ID we use to key your content.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Cloudflare Turnstile</span> — Bot check during sign-up (loaded by Clerk): browser signals from your device.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">MongoDB Atlas</span> — Database hosting: everything you create and store on WinQA (prompts, bug reports, test cases, insights, battles, usage counters).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Vercel</span> — Hosting and request logs. Analytics is described under Usage Analytics above.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Cohere, Google Gemini API, Groq, Mistral</span> — AI providers: your prompts and conversation, plus your own API key for that provider if you saved one.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Judge0 CE (ce.judge0.com)</span> — Code execution: the code you run and its standard input.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Piston public API (emkc.org)</span> — Code execution fallback when Judge0 CE fails: the code you run and its standard input.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Judge0 via RapidAPI (judge0-ce.p.rapidapi.com)</span> — Code execution fallback, used when configured: the code you run and its standard input.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5">&bull;</span>
                  <span><span className="text-white">Custom providers you configure</span> — They receive what you send to them, including your key for that provider, under your own account with that provider. Check their privacy policy.</span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">6</span>
              Cookies
            </h2>
            <p className="text-sm">
              WinQA uses essential cookies for authentication (managed by Clerk) and session management. We use Vercel Analytics which may set anonymous performance cookies. We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">7</span>
              Your Rights
            </h2>
            <p className="text-sm mb-3">You have the right to:</p>
            <ul className="space-y-2 ml-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Access or update your account details through Manage account in your profile menu.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Delete your account. Deleting your account deletes your content, battles, usage counters and saved keys from our database within minutes. Public library items you contributed stay, re-attributed to WinQA. To delete, use Manage account in your profile menu, or email{' '}
                  <a href="mailto:privacy@winqa.ai" className="text-orange-500 hover:text-orange-400 underline underline-offset-4">privacy@winqa.ai</a>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Remove saved API keys at any time in Settings.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Delete any content you have created (prompts, bugs, test cases, insights)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-0.5">&bull;</span>
                <span>Export your bug reports, prompts, test cases and insights from Settings. Other data, such as battles and usage counters, is not part of that export; email{' '}
                  <a href="mailto:privacy@winqa.ai" className="text-orange-500 hover:text-orange-400 underline underline-offset-4">privacy@winqa.ai</a>{' '}to request it.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">8</span>
              Changes to This Policy
            </h2>
            <p className="text-sm">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date. Your continued use of WinQA after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white font-heading mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-sm font-mono">9</span>
              Contact
            </h2>
            <p className="text-sm">
              For questions about this Privacy Policy, or to request deletion or access to your data, email{' '}
              <a href="mailto:privacy@winqa.ai" className="text-orange-500 hover:text-orange-400 underline underline-offset-4">privacy@winqa.ai</a>.
              For bugs and feature requests, open an issue on our{' '}
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
          <Link href="/terms" className="inline-flex items-center min-h-[44px] px-1 text-sm text-zinc-500 hover:text-orange-500 transition-colors font-mono">
            Terms of Service &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
