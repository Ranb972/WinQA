'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { LLMProvider } from '@/lib/llm/types';
import {
  providerDisplayNames,
  specificModelDisplayNames,
} from '@/lib/llm';
import { PROVIDER_MODELS } from '@/lib/llm/models';

// --- Types ---

type Winner = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'tie';

interface FighterConfig {
  provider: LLMProvider | '';
  model: string;
}

type RevealPhase = 'overlay' | 'revealA' | 'revealB' | 'verdict' | 'done';

interface BlindfoldRevealProps {
  fighterA: FighterConfig;
  fighterB: FighterConfig;
  winner: Winner;
  onComplete: () => void;
}

// --- Helpers ---

const providerGradients: Record<LLMProvider, string> = {
  cohere: 'from-purple-600 to-purple-900',
  gemini: 'from-blue-600 to-blue-900',
  groq: 'from-orange-600 to-orange-900',
  openrouter: 'from-green-600 to-green-900',
};

function getDisplayName(provider: string, model: string): string {
  if (specificModelDisplayNames[model as keyof typeof specificModelDisplayNames]) {
    return specificModelDisplayNames[model as keyof typeof specificModelDisplayNames];
  }
  const providerModels = PROVIDER_MODELS[provider as LLMProvider];
  const found = providerModels?.find((m) => m.id === model);
  return found?.name || model || provider;
}

// --- Sparkle Particle ---

function SparkleParticle({ delay }: { delay: number }) {
  const x = Math.random() * 100 - 50;
  const y = Math.random() * 60 - 30;
  return (
    <motion.div
      className="absolute"
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0],
        x: x,
        y: y,
      }}
      transition={{ duration: 1, delay, ease: 'easeOut' }}
    >
      <Sparkles className="h-4 w-4 text-amber-400" />
    </motion.div>
  );
}

// --- Main Component ---

export default function BlindfoldReveal({
  fighterA,
  fighterB,
  winner,
  onComplete,
}: BlindfoldRevealProps) {
  const [phase, setPhase] = useState<RevealPhase>('overlay');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // overlay → revealA after 2s
    timers.push(setTimeout(() => setPhase('revealA'), 2000));
    // revealA → revealB after 3.2s (1.2s for card A flip)
    timers.push(setTimeout(() => setPhase('revealB'), 3200));
    // revealB → verdict after 4.4s (1.2s for card B flip)
    timers.push(setTimeout(() => setPhase('verdict'), 4400));
    // verdict → done after 6s
    timers.push(setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 6000));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const nameA = getDisplayName(fighterA.provider, fighterA.model);
  const nameB = getDisplayName(fighterB.provider, fighterB.model);
  const providerA = providerDisplayNames[fighterA.provider as LLMProvider] || fighterA.provider;
  const providerB = providerDisplayNames[fighterB.provider as LLMProvider] || fighterB.provider;
  const gradientA = providerGradients[fighterA.provider as LLMProvider] || 'from-slate-600 to-slate-900';
  const gradientB = providerGradients[fighterB.provider as LLMProvider] || 'from-slate-600 to-slate-900';

  const winnerName =
    winner === 'modelA' ? nameA : winner === 'modelB' ? nameB : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div className="max-w-2xl w-full mx-4">
        <AnimatePresence mode="wait">
          {/* Phase 1: THE REVEAL text */}
          {phase === 'overlay' && (
            <motion.div
              key="overlay"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150 }}
              className="text-center"
            >
              <motion.div
                animate={{
                  textShadow: [
                    '0 0 20px rgba(245, 158, 11, 0.3)',
                    '0 0 60px rgba(245, 158, 11, 0.8)',
                    '0 0 20px rgba(245, 158, 11, 0.3)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <span className="text-6xl md:text-7xl block mb-4">🎭</span>
                <h2 className="text-5xl md:text-6xl font-black text-amber-400 tracking-tight">
                  THE REVEAL
                </h2>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-slate-400 mt-4 text-lg"
              >
                Who wrote what?
              </motion.p>
            </motion.div>
          )}

          {/* Phase 2-3: Card Reveals */}
          {(phase === 'revealA' || phase === 'revealB' || phase === 'verdict') && (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* Card A */}
              <div className="h-48" style={{ perspective: '1000px' }}>
                <motion.div
                  className="relative w-full h-full"
                  initial={{ rotateY: 0 }}
                  animate={{
                    rotateY:
                      phase === 'revealA' || phase === 'revealB' || phase === 'verdict'
                        ? 180
                        : 0,
                  }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Front - Mystery */}
                  <div
                    className="absolute inset-0 bg-slate-900/80 border border-slate-700 rounded-2xl flex items-center justify-center"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">🎭</span>
                      <span className="text-xl font-bold text-slate-300">Mystery A</span>
                    </div>
                  </div>

                  {/* Back - Revealed */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradientA} border border-white/20 rounded-2xl flex items-center justify-center`}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div className="text-center relative">
                      {/* Sparkle particles */}
                      {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((d, i) => (
                        <SparkleParticle key={i} delay={d} />
                      ))}
                      <span className="text-2xl font-black text-white block mb-1">{nameA}</span>
                      <span className="text-sm text-white/70">{providerA}</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Card B */}
              <div className="h-48" style={{ perspective: '1000px' }}>
                <motion.div
                  className="relative w-full h-full"
                  initial={{ rotateY: 0 }}
                  animate={{
                    rotateY:
                      phase === 'revealB' || phase === 'verdict' ? 180 : 0,
                  }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Front - Mystery */}
                  <div
                    className="absolute inset-0 bg-slate-900/80 border border-slate-700 rounded-2xl flex items-center justify-center"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">🎭</span>
                      <span className="text-xl font-bold text-slate-300">Mystery B</span>
                    </div>
                  </div>

                  {/* Back - Revealed */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradientB} border border-white/20 rounded-2xl flex items-center justify-center`}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div className="text-center relative">
                      {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((d, i) => (
                        <SparkleParticle key={i} delay={d} />
                      ))}
                      <span className="text-2xl font-black text-white block mb-1">{nameB}</span>
                      <span className="text-sm text-white/70">{providerB}</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Verdict (appears in verdict phase) */}
              <AnimatePresence>
                {phase === 'verdict' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="col-span-1 md:col-span-2 text-center mt-4"
                  >
                    <div className="inline-block bg-slate-900/80 border border-amber-500/40 rounded-2xl px-8 py-5">
                      {winner === 'tie' ? (
                        <p className="text-2xl font-bold text-amber-400">
                          🤝 Too close to call!
                        </p>
                      ) : (
                        <p className="text-2xl font-bold text-amber-400">
                          🎯 You chose {winnerName}!
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
