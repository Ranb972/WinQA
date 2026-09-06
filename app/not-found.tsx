import Link from 'next/link';
import { FlaskConical, SearchX, Swords } from 'lucide-react';
import PublicShell from '@/components/PublicShell';

export const metadata = { title: 'Page not found' };

// Root-level 404 (server component). It sits outside both route groups, so
// app/layout.tsx is the only layout that applies — that already supplies
// ClerkProvider, the font variables, `bg-black text-slate-100` and the ambient
// background, but not the (public) group's chrome. PublicShell is therefore
// wrapped in explicitly, exactly as app/(public)/layout.tsx does: it is a
// client `useUser` shell, so signed-in visitors get the Navbar after hydration
// while /_not-found still prerenders static.
export default function NotFound() {
  return (
    <PublicShell>
      <div className="min-h-[100svh] bg-black text-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-mono uppercase tracking-widest">
            <SearchX className="w-3.5 h-3.5" />
            Case File 404
          </span>

          <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-white font-heading tracking-tight">
            This page doesn&apos;t exist.
          </h1>
          <p className="mt-3 max-w-md text-zinc-400 text-base leading-relaxed">
            The trail went cold. Nothing in WinQA matches that URL &mdash; it
            may have moved, or it was never here.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 min-h-[44px] py-2.5 mt-8 text-sm text-orange-500/70 hover:text-orange-500 transition-colors font-mono"
          >
            &larr; Back to WinQA
          </Link>

          <div className="mt-10 w-full grid gap-3 sm:grid-cols-2 text-left">
            <Link
              href="/chat-lab"
              className="inline-flex items-center min-h-[44px] p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-orange-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <FlaskConical className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <span className="text-white font-heading font-semibold block">
                    Chat Lab
                  </span>
                  <p className="text-sm text-zinc-400">
                    Ask several models the same question and compare the
                    answers.
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/battle"
              className="inline-flex items-center min-h-[44px] p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-orange-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Swords className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <span className="text-white font-heading font-semibold block">
                    AI Battle Arena
                  </span>
                  <p className="text-sm text-zinc-400">
                    Head-to-head challenges built to expose where models crack.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
