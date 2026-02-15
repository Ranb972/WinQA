'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Crown,
  Trophy,
  Sparkles,
  RotateCcw,
  Clock,
  Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LLMProvider } from '@/lib/llm/types';
import {
  modelColors,
  providerDisplayNames,
  specificModelDisplayNames,
} from '@/lib/llm';
import { PROVIDER_MODELS } from '@/lib/llm/models';

// --- Types ---

interface Ratings {
  accuracy: number;
  creativity: number;
  clarity: number;
  total: number;
}

interface BattleResponse {
  content: string;
  responseTime: number;
  specificModel?: string;
  error?: string;
}

interface FighterConfig {
  provider: LLMProvider | '';
  model: string;
}

export interface RoyaleRanking {
  provider: string;
  model: string;
  rank: number;
  score: number;
  ratings: Ratings;
}

interface BattleRoyaleArenaProps {
  responses: (BattleResponse | null)[];
  fighters: FighterConfig[];
  onChampionCrowned: (rankings: RoyaleRanking[]) => void;
}

type EliminationPhase = 'idle' | 'suspense' | 'spotlight' | 'shaking' | 'eliminated';

// --- Helpers ---

const providerColorDots: Record<LLMProvider, string> = {
  cohere: 'bg-purple-400',
  gemini: 'bg-blue-400',
  groq: 'bg-orange-400',
  openrouter: 'bg-green-400',
};

const providerBorderColors: Record<LLMProvider, string> = {
  cohere: 'border-purple-500/40',
  gemini: 'border-blue-500/40',
  groq: 'border-orange-500/40',
  openrouter: 'border-green-500/40',
};

function getDisplayName(provider: string, model: string): string {
  if (specificModelDisplayNames[model as keyof typeof specificModelDisplayNames]) {
    return specificModelDisplayNames[model as keyof typeof specificModelDisplayNames];
  }
  const providerModels = PROVIDER_MODELS[provider as LLMProvider];
  const found = providerModels?.find((m) => m.id === model);
  return found?.name || model || provider;
}

const emptyRatings = (): Ratings => ({ accuracy: 0, creativity: 0, clarity: 0, total: 0 });

// --- Sub-components ---

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-20">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileTap={{ scale: 1.3 }}
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
              }`}
            />
          </motion.button>
        ))}
      </div>
      <span className="text-xs text-slate-500">{value}/5</span>
    </div>
  );
}

function MarkdownResponse({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => (
          <pre className="bg-slate-950 rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return <code className="font-mono text-slate-200">{children}</code>;
          }
          return (
            <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          );
        },
        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-slate-200 italic">{children}</em>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// --- Main Component ---

export default function BattleRoyaleArena({
  responses,
  fighters,
  onChampionCrowned,
}: BattleRoyaleArenaProps) {
  const [round, setRound] = useState(1);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [rankings, setRankings] = useState<RoyaleRanking[]>([]);
  const [roundRatings, setRoundRatings] = useState<Record<number, Ratings>>({
    0: emptyRatings(),
    1: emptyRatings(),
    2: emptyRatings(),
    3: emptyRatings(),
  });
  const [eliminationPhase, setEliminationPhase] = useState<EliminationPhase>('idle');
  const [eliminatingIdx, setEliminatingIdx] = useState<number | null>(null);
  const [spotlightIdx, setSpotlightIdx] = useState<number | null>(null);
  const [champion, setChampion] = useState<number | null>(null);

  const activeIndices = [0, 1, 2, 3].filter((i) => !eliminatedIndices.includes(i));

  const updateRating = (
    idx: number,
    field: 'accuracy' | 'creativity' | 'clarity',
    value: number
  ) => {
    setRoundRatings((prev) => {
      const current = prev[idx] || emptyRatings();
      const updated = { ...current, [field]: value };
      updated.total = updated.accuracy + updated.creativity + updated.clarity;
      return { ...prev, [idx]: updated };
    });
  };

  const allActiveRated = activeIndices.every((idx) => {
    const r = roundRatings[idx];
    return r && r.accuracy > 0 && r.creativity > 0 && r.clarity > 0;
  });

  const runElimination = useCallback(() => {
    // Find lowest scoring active model
    let lowestIdx = activeIndices[0];
    let lowestScore = roundRatings[lowestIdx]?.total || 0;
    for (const idx of activeIndices) {
      const score = roundRatings[idx]?.total || 0;
      if (score < lowestScore) {
        lowestScore = score;
        lowestIdx = idx;
      }
    }

    // Start elimination sequence
    setEliminationPhase('suspense');

    // Spotlight sweep across active cards
    setTimeout(() => {
      setEliminationPhase('spotlight');
      let spotlightStep = 0;
      const spotlightInterval = setInterval(() => {
        setSpotlightIdx(activeIndices[spotlightStep % activeIndices.length]);
        spotlightStep++;
        if (spotlightStep >= activeIndices.length * 2) {
          clearInterval(spotlightInterval);
          setSpotlightIdx(lowestIdx);
          // Start shaking
          setTimeout(() => {
            setEliminatingIdx(lowestIdx);
            setEliminationPhase('shaking');

            // Eliminated
            setTimeout(() => {
              setEliminationPhase('eliminated');

              // Calculate rank (4th for first elimination, 3rd for second, etc.)
              const rank = 4 - eliminatedIndices.length;
              const fighter = fighters[lowestIdx];
              const newRanking: RoyaleRanking = {
                provider: fighter.provider as string,
                model: fighter.model,
                rank,
                score: lowestScore,
                ratings: roundRatings[lowestIdx] || emptyRatings(),
              };

              setTimeout(() => {
                const newEliminated = [...eliminatedIndices, lowestIdx];
                setEliminatedIndices(newEliminated);
                setRankings((prev) => [...prev, newRanking]);
                setEliminationPhase('idle');
                setEliminatingIdx(null);
                setSpotlightIdx(null);

                // Reset ratings for next round
                setRoundRatings({
                  0: emptyRatings(),
                  1: emptyRatings(),
                  2: emptyRatings(),
                  3: emptyRatings(),
                });

                // Check if final round
                const remaining = [0, 1, 2, 3].filter((i) => !newEliminated.includes(i));
                if (remaining.length === 1) {
                  // We have a champion!
                  const champIdx = remaining[0];
                  setChampion(champIdx);

                  const champFighter = fighters[champIdx];
                  const champRating = roundRatings[champIdx] || emptyRatings();
                  const champRanking: RoyaleRanking = {
                    provider: champFighter.provider as string,
                    model: champFighter.model,
                    rank: 1,
                    score: champRating.total,
                    ratings: champRating,
                  };

                  const finalRankings = [...rankings, newRanking, champRanking].sort(
                    (a, b) => a.rank - b.rank
                  );

                  // Delay to show champion animation
                  setTimeout(() => {
                    onChampionCrowned(finalRankings);
                  }, 3000);
                } else {
                  setRound((r) => r + 1);
                }
              }, 1000);
            }, 800);
          }, 300);
        }
      }, 200);
    }, 1500);
  }, [activeIndices, roundRatings, eliminatedIndices, fighters, rankings, onChampionCrowned]);

  const isFinalRound = activeIndices.length === 2;
  const roundLabel =
    round === 1
      ? 'Round 1: Eliminate the Weakest!'
      : round === 2
      ? `Round 2: ${activeIndices.length} Remain!`
      : 'FINAL: 2 Warriors Stand!';

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="h-6 w-6 text-amber-400" />
          <h2 className="text-2xl font-bold text-white">BATTLE ROYALE</h2>
          <Crown className="h-6 w-6 text-amber-400" />
        </div>
        <motion.p
          key={round}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-amber-300/80 font-medium"
        >
          {roundLabel}
        </motion.p>
      </motion.div>

      {/* Suspense Text */}
      <AnimatePresence>
        {eliminationPhase === 'suspense' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mb-6"
          >
            <motion.p
              animate={{
                textShadow: [
                  '0 0 10px rgba(239, 68, 68, 0.3)',
                  '0 0 30px rgba(239, 68, 68, 0.6)',
                  '0 0 10px rgba(239, 68, 68, 0.3)',
                ],
              }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-xl font-bold text-red-400"
            >
              The model leaving the arena is...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Champion Animation */}
      <AnimatePresence>
        {champion !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 150 }}
            className="text-center mb-8"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 30px rgba(245, 158, 11, 0.3)',
                  '0 0 80px rgba(245, 158, 11, 0.6)',
                  '0 0 30px rgba(245, 158, 11, 0.3)',
                ],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="inline-block bg-gradient-to-b from-slate-900/80 to-slate-900/60 backdrop-blur-xl border border-amber-500/50 rounded-3xl px-10 py-8"
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6 }}
              >
                <Trophy className="h-16 w-16 text-amber-400 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]" />
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-black text-amber-400 mb-2">
                CHAMPION!
              </h2>
              <p className="text-xl text-white font-bold mb-3">
                {getDisplayName(fighters[champion].provider, fighters[champion].model)}
              </p>
              <p className="text-sm text-slate-400">
                {providerDisplayNames[fighters[champion].provider as LLMProvider]}
              </p>
            </motion.div>

            {/* Rankings */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {[...rankings]
                .sort((a, b) => a.rank - b.rank)
                .map((r) => {
                  const medal =
                    r.rank === 1
                      ? '🥇'
                      : r.rank === 2
                      ? '🥈'
                      : r.rank === 3
                      ? '🥉'
                      : '#4';
                  return (
                    <motion.div
                      key={r.rank}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: r.rank * 0.15 }}
                      className={`bg-slate-900/60 border rounded-xl px-4 py-3 ${
                        r.rank === 1
                          ? 'border-amber-500/40'
                          : 'border-slate-700/50'
                      }`}
                    >
                      <span className="text-lg mr-2">{medal}</span>
                      <span className="text-sm font-medium text-white">
                        {getDisplayName(r.provider, r.model)}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {r.score}/15
                      </span>
                    </motion.div>
                  );
                })}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-4"
            >
              <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                <RotateCcw className="h-3 w-3 animate-spin" />
                Saving results...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response Cards */}
      {champion === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <AnimatePresence>
            {activeIndices.map((idx) => {
              const fighter = fighters[idx];
              const response = responses[idx];
              const r = roundRatings[idx] || emptyRatings();
              const label = getDisplayName(fighter.provider, fighter.model);
              const isEliminating = eliminatingIdx === idx;
              const isSpotlight = spotlightIdx === idx;

              return (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: isEliminating && eliminationPhase === 'eliminated' ? 0 : 1,
                    y: 0,
                    scale: isEliminating && eliminationPhase === 'eliminated' ? 0 : 1,
                    x:
                      isEliminating && eliminationPhase === 'shaking'
                        ? [-10, 10, -10, 10, -5, 5, 0]
                        : 0,
                  }}
                  exit={{ opacity: 0, scale: 0, transition: { duration: 0.5 } }}
                  transition={{
                    layout: { duration: 0.5, ease: 'easeInOut' },
                    x: { duration: 0.5 },
                    opacity: { duration: 0.5 },
                    scale: { duration: 0.5 },
                  }}
                  className={`bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-5 transition-colors relative overflow-hidden ${
                    isEliminating && eliminationPhase === 'shaking'
                      ? 'border-red-500/60'
                      : isEliminating && eliminationPhase === 'eliminated'
                      ? 'border-red-500/80'
                      : isSpotlight
                      ? 'border-amber-400/60 shadow-lg shadow-amber-500/10'
                      : providerBorderColors[fighter.provider as LLMProvider] || 'border-slate-700/50'
                  }`}
                >
                  {/* Red overlay during elimination */}
                  {isEliminating && (eliminationPhase === 'shaking' || eliminationPhase === 'eliminated') && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.15 }}
                      className="absolute inset-0 bg-red-500 rounded-2xl z-10"
                    />
                  )}

                  {/* Eliminated badge */}
                  {isEliminating && eliminationPhase === 'eliminated' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center z-20"
                    >
                      <div className="bg-red-500/90 rounded-xl px-6 py-3">
                        <p className="text-white font-black text-lg">ELIMINATED!</p>
                        <p className="text-white/80 text-sm">{label}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Model Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          providerColorDots[fighter.provider as LLMProvider] || 'bg-slate-500'
                        }`}
                      />
                      <span className="font-medium text-white text-sm">{label}</span>
                      <span
                        className={`text-xs ${
                          modelColors[fighter.provider as LLMProvider] || 'text-slate-400'
                        }`}
                      >
                        {providerDisplayNames[fighter.provider as LLMProvider]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {response ? `${(response.responseTime / 1000).toFixed(1)}s` : '-'}
                    </div>
                  </div>

                  {/* Response */}
                  <div className="text-sm text-slate-300 max-h-48 overflow-y-auto scroll-smooth leading-relaxed mb-4 bg-slate-800/40 rounded-lg p-3">
                    {response?.error ? (
                      <span className="text-red-400">Error: {response.error}</span>
                    ) : response?.content ? (
                      <MarkdownResponse content={response.content} />
                    ) : (
                      <span className="text-slate-500">No response</span>
                    )}
                  </div>

                  {/* Ratings */}
                  <div className="space-y-2">
                    <StarRating
                      value={r.accuracy}
                      onChange={(v) => updateRating(idx, 'accuracy', v)}
                      label="Accuracy"
                    />
                    <StarRating
                      value={r.creativity}
                      onChange={(v) => updateRating(idx, 'creativity', v)}
                      label="Creativity"
                    />
                    <StarRating
                      value={r.clarity}
                      onChange={(v) => updateRating(idx, 'clarity', v)}
                      label="Clarity"
                    />
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
                      <span className="text-xs font-medium text-amber-400">
                        Total: {r.total}/15
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Eliminate / Crown Button */}
      {champion === null && eliminationPhase === 'idle' && (
        <div className="text-center">
          <motion.button
            whileHover={allActiveRated ? { scale: 1.05 } : {}}
            whileTap={allActiveRated ? { scale: 0.95 } : {}}
            onClick={runElimination}
            disabled={!allActiveRated}
            className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base transition-all ${
              allActiveRated
                ? isFinalRound
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-lg shadow-amber-500/30'
                  : 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isFinalRound ? (
              <>
                <Crown className="h-5 w-5" />
                CROWN THE CHAMPION!
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                ELIMINATE!
              </>
            )}
          </motion.button>
          {!allActiveRated && (
            <p className="text-xs text-slate-500 mt-2">
              Rate all {activeIndices.length} models to continue
            </p>
          )}
        </div>
      )}
    </div>
  );
}
