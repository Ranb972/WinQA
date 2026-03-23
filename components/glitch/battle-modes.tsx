"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  MessageSquare,
  Repeat,
  Layers,
  Code,
  Sparkles,
  Smile,
  EyeOff,
  Swords,
} from "lucide-react";

const categories = {
  "Mind Games": [
    {
      id: "escalation",
      name: "Escalation",
      description: "Start simple, escalate complexity. Watch AI struggle as prompts get harder.",
      icon: Zap,
      difficulty: "Medium",
    },
    {
      id: "interrogation",
      name: "The Interrogation",
      description: "Rapid-fire questions on a single topic. Expose inconsistencies in AI knowledge.",
      icon: MessageSquare,
      difficulty: "Hard",
    },
    {
      id: "whispers",
      name: "Chinese Whispers",
      description: "Pass information between models. See how truth degrades through repetition.",
      icon: Repeat,
      difficulty: "Medium",
    },
    {
      id: "buildup",
      name: "The Build-Up",
      description: "Layer context piece by piece. Test long-term coherence and memory.",
      icon: Layers,
      difficulty: "Hard",
    },
  ],
  "Spectacular": [
    {
      id: "code-duel",
      name: "Code Duel",
      description: "Models compete to write working code. Execute and compare results live.",
      icon: Code,
      difficulty: "Expert",
    },
    {
      id: "ascii",
      name: "ASCII Artist",
      description: "Challenge models to create ASCII art. Creativity meets technical precision.",
      icon: Sparkles,
      difficulty: "Hard",
    },
    {
      id: "emoji",
      name: "Emoji Story",
      description: "Tell stories using only emojis. Test symbolic reasoning and creativity.",
      icon: Smile,
      difficulty: "Easy",
    },
    {
      id: "blindfold",
      name: "The Blindfold",
      description: "Hide model names. Can you guess which AI gave which response?",
      icon: EyeOff,
      difficulty: "Medium",
    },
    {
      id: "royale",
      name: "Battle Royale",
      description: "All models, one prompt. May the best AI win.",
      icon: Swords,
      difficulty: "Expert",
    },
  ],
};

const difficultyColors: Record<string, string> = {
  "Easy": "text-green-400 border-green-400/30 bg-green-400/10",
  "Medium": "text-orange-400 border-orange-400/30 bg-orange-400/10",
  "Hard": "text-red-400 border-red-400/30 bg-red-400/10",
  "Expert": "text-purple-400 border-purple-400/30 bg-purple-400/10",
};

export function BattleModes() {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const allModes = [...categories["Mind Games"], ...categories["Spectacular"]];
  const activeMode = allModes.find(m => m.id === selectedMode);

  return (
    <section id="features" className="relative py-32 px-6">
      {/* Background accent */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-[150px]" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-16 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-orange-500" />
              <span className="text-orange-500 text-sm font-mono tracking-[0.15em] uppercase">
                Battle Challenges
              </span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] text-white leading-[0.95]">
              9 Ways to<br />
              <span className="text-orange-500">Cross-Examine</span>
            </h2>
          </motion.div>

          {/* Detail panel */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <AnimatePresence mode="wait">
              {activeMode ? (
                <motion.div
                  key={activeMode.id}
                  className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <activeMode.icon className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-1">{activeMode.name}</h3>
                      <span className={`inline-block px-2 py-0.5 text-xs font-mono rounded border ${difficultyColors[activeMode.difficulty]}`}>
                        {activeMode.difficulty}
                      </span>
                    </div>
                  </div>
                  <p className="text-white/60 text-lg leading-relaxed">
                    {activeMode.description}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  className="bg-white/[0.01] border border-dashed border-white/[0.08] rounded-lg p-8 flex items-center justify-center min-h-[200px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="text-white/20 font-mono text-sm">
                    Select a challenge to view details
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Battle modes by category */}
        <div className="space-y-12">
          {Object.entries(categories).map(([category, modes], categoryIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <p className="font-mono text-white/30 text-xs tracking-wider uppercase mb-4">
                {category}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {modes.map((mode, index) => {
                  const Icon = mode.icon;
                  const isSelected = selectedMode === mode.id;

                  return (
                    <motion.button
                      key={mode.id}
                      className={`
                        relative text-left p-4 rounded-lg border transition-all duration-200
                        ${isSelected
                          ? 'bg-orange-500/10 border-orange-500/40'
                          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
                        }
                      `}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedMode(isSelected ? null : mode.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-orange-500' : 'text-white/40'}`} />
                        <span className={`font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>
                          {mode.name}
                        </span>
                      </div>

                      <span className="absolute top-2 right-3 font-mono text-xs text-white/10">
                        {String(categoryIndex * 4 + index + 1).padStart(2, '0')}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
