"use client";

import { motion } from "framer-motion";
import { Play, Bug, FileText, Lightbulb, Columns, FlaskConical } from "lucide-react";

const tools = [
  {
    icon: Play,
    title: "Live Code Execution",
    description: "Run AI-generated code in real-time. JavaScript, Python, TypeScript.",
  },
  {
    icon: Bug,
    title: "Bug Log",
    description: "Document every hallucination and failure. Build your evidence base.",
  },
  {
    icon: FileText,
    title: "Prompt Library",
    description: "Save your best interrogation techniques. Reuse what works.",
  },
  {
    icon: FlaskConical,
    title: "Test Cases",
    description: "Create reusable test scenarios. Systematic AI evaluation.",
  },
  {
    icon: Lightbulb,
    title: "Insights",
    description: "Record patterns in AI behavior. Learn from every test.",
  },
  {
    icon: Columns,
    title: "Compare Mode",
    description: "Side-by-side model responses. See differences instantly.",
  },
];

export function ToolsSection() {
  return (
    <section className="relative py-32 px-6">
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-7xl mx-auto">
        {/* Header - Asymmetric */}
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-16 items-start mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-orange-500" />
              <span className="text-orange-500 text-sm font-mono tracking-[0.15em] uppercase">
                Your Arsenal
              </span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-white leading-[0.95]">
              Weapons of<br />
              <span className="text-orange-500">Discovery</span>
            </h2>
          </motion.div>

          <motion.p
            className="text-white/40 text-lg lg:pt-12 max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            WinQA gives you the tools to not just test AI, but to document,
            learn, and build institutional knowledge about AI behavior.
          </motion.p>
        </div>

        {/* Tools grid - 3x2 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <motion.div
                key={tool.title}
                className="group relative p-6 bg-white/[0.015] border border-white/[0.06] rounded-lg hover:border-orange-500/30 hover:bg-orange-500/[0.02] transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-white/[0.03] group-hover:bg-orange-500/10 flex items-center justify-center mb-5 transition-colors border border-white/[0.04]">
                  <Icon className="w-5 h-5 text-white/50 group-hover:text-orange-500 transition-colors" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">{tool.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{tool.description}</p>

                {/* Number */}
                <span className="absolute top-4 right-4 font-mono text-xs text-white/10">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
