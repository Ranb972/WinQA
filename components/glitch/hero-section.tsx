"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SignUpButton } from "@clerk/nextjs";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center px-6 py-24 overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Ambient glow */}
      <div className="absolute top-1/3 -left-32 w-96 h-96 bg-orange-500/8 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Investigation badge */}
            <motion.div
              className="inline-flex items-center gap-3 mb-10"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="w-8 h-px bg-orange-500" />
              <span className="text-orange-500 text-sm font-mono tracking-[0.15em] uppercase">
                AI Investigation Unit
              </span>
            </motion.div>

            {/* Main headline */}
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-[-0.03em] text-white leading-[0.95] mb-8">
              Interrogate<br />
              <span className="text-orange-500">the AI.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-white/50 max-w-xl mb-12 leading-relaxed">
              Compare Gemini, Cohere, Groq, and OpenRouter side-by-side.
              Run 9 battle challenges. Document every hallucination. Build evidence.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-6">
              <SignUpButton mode="modal">
                <motion.button
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-orange-500 text-black font-semibold rounded-lg hover:bg-orange-400 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start Investigation
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </SignUpButton>
              <span className="text-white/30 font-mono text-sm">100% Free</span>
            </div>
          </motion.div>

          {/* Right: Stats card */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="font-mono text-white/40 text-xs tracking-wider uppercase">System Status</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-white/40 text-xs font-mono">ONLINE</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <StatBox label="AI Providers" value="4" />
                  <StatBox label="Battle Modes" value="9" />
                </div>

                <div className="my-6 h-px bg-white/[0.06]" />

                {/* Providers list */}
                <div>
                  <p className="font-mono text-white/30 text-xs mb-4 tracking-wider uppercase">Connected Providers</p>
                  <div className="space-y-2">
                    {['Cohere', 'Gemini', 'Groq', 'OpenRouter'].map((provider, i) => (
                      <motion.div
                        key={provider}
                        className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.04] rounded"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.08 }}
                      >
                        <span className="text-white/70 text-sm">{provider}</span>
                        <span className="text-orange-500/60 text-xs font-mono">READY</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Free badge */}
                <div className="mt-6 pt-6 border-t border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded text-orange-500 text-xs font-mono">
                      FREE
                    </span>
                    <span className="text-white/30 text-sm">No credit card required</span>
                  </div>
                </div>
              </div>

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-orange-500/30 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-orange-500/30 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-orange-500/30 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-orange-500/30 rounded-br-lg" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded">
      <p className="font-mono text-white/30 text-xs mb-2 uppercase tracking-wider">{label}</p>
      <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}
