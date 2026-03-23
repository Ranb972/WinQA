"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SignUpButton } from "@clerk/nextjs";

export function CTASection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-orange-500/5 rounded-full blur-[150px]" />

      <div className="max-w-4xl mx-auto text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="w-12 h-px bg-orange-500/50" />
            <span className="text-orange-500 font-mono text-xs tracking-[0.2em] uppercase">
              Join Now
            </span>
            <span className="w-12 h-px bg-orange-500/50" />
          </div>

          {/* Two-sentence headline with reflection effect */}
          <div className="relative mb-16 text-center">
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] text-white leading-[1.1]">
              Stop guessing.
            </h2>
            <h2
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] leading-[1.1] text-orange-500 mt-2 pointer-events-none select-none"
              style={{
                transform: 'scaleY(-1)',
                filter: 'blur(0.5px)',
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
              }}
            >
              Start testing.
            </h2>
          </div>

          {/* CTA button */}
          <SignUpButton mode="modal">
            <motion.button
              className="group inline-flex items-center gap-3 px-10 py-5 bg-orange-500 text-black font-semibold text-lg rounded-lg hover:bg-orange-400 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Enter WinQA
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </SignUpButton>

          {/* Sub-text */}
          <motion.p
            className="mt-8 text-white/30 text-sm font-mono tracking-wide"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            No signup &middot; Free forever &middot; Open to all
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
