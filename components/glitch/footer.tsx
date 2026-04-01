"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative py-8 px-6 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <span className="font-heading text-lg font-bold text-white">
              Win<span className="text-orange-500">QA</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-white/30 text-sm">AI Testing Playground</span>
          </div>

          {/* Right: Legal + site link */}
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="text-white/40 text-sm hover:text-orange-500 transition-colors font-mono"
            >
              Privacy
            </Link>
            <span className="text-white/20">|</span>
            <Link
              href="/terms"
              className="text-white/40 text-sm hover:text-orange-500 transition-colors font-mono"
            >
              Terms
            </Link>
            <span className="text-white/20">·</span>
            <a
              href="https://winqa.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 text-sm hover:text-orange-500 transition-colors font-mono"
            >
              winqa.ai
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
