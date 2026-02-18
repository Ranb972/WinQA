'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import {
  Flame,
  Trophy,
  History,
  Shuffle,
  Clock,
  ChevronDown,
  ChevronUp,
  Crown,
  Swords,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Zap,
  Shield,
  ScrollText,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BATTLE_CHALLENGES, BattleChallenge } from '@/lib/battle-challenges';
import { PROVIDER_MODELS, getDefaultModel } from '@/lib/llm/models';
import { LLMProvider } from '@/lib/llm/types';
import {
  modelDisplayNames,
  modelColors,
  providerDisplayNames,
  specificModelDisplayNames,
  defaultModels,
} from '@/lib/llm';
import CodeDuelJudging from './components/CodeDuelJudging';
import BlindfoldReveal from './components/BlindfoldReveal';
import BattleRoyaleArena, { type RoyaleRanking } from './components/BattleRoyaleArena';

// --- Types ---

type BattleState = 'setup' | 'battling' | 'judging' | 'results';
type ActiveTab = 'battle' | 'leaderboard' | 'history';
type Winner = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'tie';

interface FighterConfig {
  provider: LLMProvider | '';
  model: string;
}

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

interface LeaderboardEntry {
  _id: string;
  provider: string;
  modelId: string;
  wins: number;
  losses: number;
  ties: number;
  totalBattles: number;
  avgAccuracy: number;
  avgCreativity: number;
  avgClarity: number;
  avgTotal: number;
}

interface HistoryEntry {
  _id: string;
  challengeId: string;
  challengeName: string;
  prompt: string;
  battleType: string;
  modelA: { provider: string; model: string };
  modelB: { provider: string; model: string };
  modelC?: { provider: string; model: string };
  modelD?: { provider: string; model: string };
  responseA: BattleResponse;
  responseB: BattleResponse;
  responseC?: BattleResponse;
  responseD?: BattleResponse;
  ratings: {
    modelA: Ratings;
    modelB: Ratings;
    modelC?: Ratings;
    modelD?: Ratings;
  };
  winner: Winner;
  created_at: string;
}

// --- Helpers ---

const providers = Object.keys(PROVIDER_MODELS) as LLMProvider[];

const providerColorDots: Record<LLMProvider, string> = {
  cohere: 'bg-purple-400',
  gemini: 'bg-blue-400',
  groq: 'bg-orange-400',
  openrouter: 'bg-green-400',
};

function getDisplayName(provider: string, model: string): string {
  const p = provider as LLMProvider;
  if (specificModelDisplayNames[model as keyof typeof specificModelDisplayNames]) {
    return specificModelDisplayNames[model as keyof typeof specificModelDisplayNames];
  }
  const providerModels = PROVIDER_MODELS[p];
  const found = providerModels?.find((m) => m.id === model);
  return found?.name || model || modelDisplayNames[p] || provider;
}

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = 30000
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const emptyRatings = (): Ratings => ({ accuracy: 0, creativity: 0, clarity: 0, total: 0 });

// --- Markdown renderer for battle responses ---

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
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold text-white mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// --- Extracted Components (outside BattlePage to prevent remount on re-render) ---

function FighterCard({
  fighter,
  setFighter,
  label,
  onProviderChange,
}: {
  fighter: FighterConfig;
  setFighter: (f: FighterConfig) => void;
  label: string;
  onProviderChange: (fighter: 'A' | 'B', provider: LLMProvider) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="bg-slate-900/50 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-6">
        <h3 className="text-sm font-medium text-slate-400 mb-4">{label}</h3>

        {/* Provider Select */}
        <div className="mb-3">
          <label className="text-xs text-slate-500 mb-1 block">Provider</label>
          <select
            value={fighter.provider}
            onChange={(e) =>
              onProviderChange(
                label.includes('A') || label.includes('1') ? 'A' : 'B',
                e.target.value as LLMProvider
              )
            }
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
          >
            <option value="">Select Provider</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {providerDisplayNames[p]}
              </option>
            ))}
          </select>
        </div>

        {/* Model Select */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Model</label>
          <select
            value={fighter.model}
            onChange={(e) =>
              setFighter({ ...fighter, model: e.target.value })
            }
            disabled={!fighter.provider}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors disabled:opacity-50"
          >
            <option value="">Select Model</option>
            {fighter.provider &&
              PROVIDER_MODELS[fighter.provider]?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>

        {/* Provider color indicator */}
        {fighter.provider && (
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${providerColorDots[fighter.provider as LLMProvider]}`}
            />
            <span className={`text-xs ${modelColors[fighter.provider as LLMProvider]}`}>
              {modelDisplayNames[fighter.provider as LLMProvider]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Component ---

export default function BattlePage() {
  const { user } = useUser();

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('battle');

  // Battle flow state
  const [battleState, setBattleState] = useState<BattleState>('setup');

  // Setup
  const [fighterA, setFighterA] = useState<FighterConfig>({ provider: '', model: '' });
  const [fighterB, setFighterB] = useState<FighterConfig>({ provider: '', model: '' });
  const [selectedChallenge, setSelectedChallenge] = useState<BattleChallenge | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  // Battling
  const [responses, setResponses] = useState<(BattleResponse | null)[]>([null, null]);
  const [elapsedTimes, setElapsedTimes] = useState<number[]>([0, 0]);
  const [battlePrompt, setBattlePrompt] = useState('');
  const [royalePrompts, setRoyalePrompts] = useState<string[]>([]);
  const timerRefs = useRef<ReturnType<typeof setInterval>[]>([]);

  // Judging
  const [ratingsA, setRatingsA] = useState<Ratings>(emptyRatings());
  const [ratingsB, setRatingsB] = useState<Ratings>(emptyRatings());
  const [ratingsC, setRatingsC] = useState<Ratings>(emptyRatings());
  const [ratingsD, setRatingsD] = useState<Ratings>(emptyRatings());
  const [winner, setWinner] = useState<Winner | null>(null);
  const [blindfoldRevealed, setBlindfoldRevealed] = useState(false);

  // Blindfold reveal overlay
  const [showBlindfoldReveal, setShowBlindfoldReveal] = useState(false);

  // Royale rankings (stored after champion crowned)
  const [royaleRankings, setRoyaleRankings] = useState<RoyaleRanking[] | null>(null);

  // Results
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Leaderboard & History
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [leaderboardSort, setLeaderboardSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'winRate',
    dir: 'desc',
  });

  // Special challenge types
  const isRoyale = selectedChallenge?.special === 'royale';
  const isBlindfold = selectedChallenge?.special === 'blindfold';
  const isCodeDuel = selectedChallenge?.special === 'code-duel';

  // --- Setup helpers ---

  const canStartBattle = isRoyale
    ? !!selectedChallenge
    : fighterA.provider &&
      fighterB.provider &&
      (selectedChallenge || (useCustomPrompt && customPrompt.trim()));

  const handleRandomMatchup = () => {
    const shuffled = [...providers].sort(() => Math.random() - 0.5);
    const pA = shuffled[0];
    const pB = shuffled[1];
    setFighterA({ provider: pA, model: getDefaultModel(pA) || '' });
    setFighterB({ provider: pB, model: getDefaultModel(pB) || '' });
  };

  const handleProviderChange = (
    fighter: 'A' | 'B',
    provider: LLMProvider
  ) => {
    const model = getDefaultModel(provider) || '';
    const setter = fighter === 'A' ? setFighterA : setFighterB;
    setter({ provider, model });
  };

  // --- Single-model fetch for progressive display ---

  const fetchSingleResponse = async (
    fighter: FighterConfig,
    prompt: string,
    idx: number
  ): Promise<BattleResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch('/api/battle/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: fighter.provider,
          model: fighter.model,
          prompt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        return { content: '', responseTime: 0, error: data.error || 'Request failed' };
      }
      return {
        content: data.content || '',
        responseTime: data.responseTime || 0,
        specificModel: data.specificModel,
        error: data.error,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return {
        content: '',
        responseTime: 0,
        error: err instanceof Error ? err.message : 'Request failed',
      };
    }
  };

  // --- Fetch responses for a round (used by BattleRoyaleArena for rounds 2+) ---

  const fetchRoundResponses = async (
    roundFighters: FighterConfig[],
    prompt: string
  ): Promise<BattleResponse[]> => {
    const promises = roundFighters.map((fighter) =>
      fetchSingleResponse(fighter, prompt, 0)
    );
    return Promise.all(promises);
  };

  // --- Battle execution ---

  const startBattle = async () => {
    if (!canStartBattle) return;

    const challenge = selectedChallenge;
    let prompt: string;
    let selectedRoyalePrompts: string[] = [];
    if (useCustomPrompt) {
      prompt = customPrompt;
    } else if (isRoyale && challenge) {
      // Pick a random set of 3 from the 30 prompts (10 sets of 3 consecutive)
      const setCount = Math.floor(challenge.prompts.length / 3);
      const setIdx = Math.floor(Math.random() * setCount) * 3;
      selectedRoyalePrompts = challenge.prompts.slice(setIdx, setIdx + 3);
      prompt = selectedRoyalePrompts[0];
      setRoyalePrompts(selectedRoyalePrompts);
    } else {
      prompt = challenge?.prompts?.[Math.floor(Math.random() * challenge.prompts.length)] || '';
    }
    setBattlePrompt(prompt);
    setBattleState('battling');

    // Setup models
    let contenders: FighterConfig[];
    if (isRoyale) {
      contenders = providers.map((p) => ({ provider: p, model: defaultModels[p] }));
      setResponses([null, null, null, null]);
      setElapsedTimes([0, 0, 0, 0]);
    } else {
      contenders = [fighterA, fighterB];
      setResponses([null, null]);
      setElapsedTimes([0, 0]);
    }

    // Start timers
    timerRefs.current.forEach(clearInterval);
    timerRefs.current = contenders.map((_, i) => {
      const startTime = Date.now();
      return setInterval(() => {
        setElapsedTimes((prev) => {
          const next = [...prev];
          next[i] = (Date.now() - startTime) / 1000;
          return next;
        });
      }, 100);
    });

    // Fire N parallel single-model requests — each updates its slot progressively
    const promises = contenders.map((fighter, idx) =>
      fetchSingleResponse(fighter, prompt, idx).then((response) => {
        // Stop this model's timer
        if (timerRefs.current[idx]) {
          clearInterval(timerRefs.current[idx]);
        }
        // Update elapsed time from actual response time
        setElapsedTimes((prev) => {
          const next = [...prev];
          next[idx] = response.responseTime / 1000;
          return next;
        });
        // Set this model's response immediately (progressive display)
        setResponses((prev) => {
          const next = [...prev];
          next[idx] = response;
          return next;
        });
        return response;
      })
    );

    // Wait for all to finish, then transition to judging
    await Promise.allSettled(promises);

    timerRefs.current.forEach(clearInterval);
    timerRefs.current = [];

    // If royale, update fighters to match the actual models used
    if (isRoyale) {
      setFighterA({ provider: contenders[0].provider as LLMProvider, model: contenders[0].model });
      setFighterB({ provider: contenders[1].provider as LLMProvider, model: contenders[1].model });
    }

    setBattleState('judging');
  };

  // --- Judging ---

  const submitVote = async () => {
    if (!winner) return;
    setSaveStatus('saving');

    const challenge = selectedChallenge;
    const battleType = isRoyale ? 'royale' : isBlindfold ? 'blindfold' : 'standard';

    // Sanitize responses: ensure content is never empty (Mongoose rejects empty required strings)
    const sanitizeResponse = (r: BattleResponse | null) => {
      if (!r) return { content: '[No response]', responseTime: 0 };
      return {
        content: r.content || (r.error ? `[Error] ${r.error}` : '[No response]'),
        responseTime: r.responseTime,
        specificModel: r.specificModel,
        error: r.error,
      };
    };

    const body: Record<string, unknown> = {
      challengeId: challenge?.id || 'custom',
      challengeName: challenge?.name || 'Custom Challenge',
      prompt: battlePrompt,
      battleType,
      modelA: { provider: fighterA.provider, model: fighterA.model },
      modelB: { provider: fighterB.provider, model: fighterB.model },
      responseA: sanitizeResponse(responses[0]),
      responseB: sanitizeResponse(responses[1]),
      ratings: {
        modelA: ratingsA,
        modelB: ratingsB,
      },
      winner,
    };

    if (isRoyale) {
      const royaleProviders = providers;
      body.modelC = { provider: royaleProviders[2], model: getDefaultModel(royaleProviders[2]) || '' };
      body.modelD = { provider: royaleProviders[3], model: getDefaultModel(royaleProviders[3]) || '' };
      body.responseC = sanitizeResponse(responses[2]);
      body.responseD = sanitizeResponse(responses[3]);
      (body.ratings as Record<string, Ratings>).modelC = ratingsC;
      (body.ratings as Record<string, Ratings>).modelD = ratingsD;
    }

    try {
      const res = await fetch('/api/battle/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setBattleState('results');
    } catch {
      setSaveStatus('error');
    }
  };

  // --- Blindfold submit handler ---

  const handleBlindfoldOrSubmit = () => {
    if (isBlindfold && !blindfoldRevealed) {
      setShowBlindfoldReveal(true);
    } else {
      submitVote();
    }
  };

  // --- Royale complete handler ---

  const handleRoyaleComplete = async (finalRankings: RoyaleRanking[]) => {
    setRoyaleRankings(finalRankings);
    setSaveStatus('saving');

    const challenge = selectedChallenge;
    const championRanking = finalRankings.find((r) => r.rank === 1)!;

    // Map rankings to model keys
    const modelKeys = ['modelA', 'modelB', 'modelC', 'modelD'] as const;
    const allFighters = providers.map((p) => ({ provider: p, model: defaultModels[p] }));

    // Find which model key the champion corresponds to
    const championIdx = allFighters.findIndex(
      (f) => f.provider === championRanking.provider && f.model === championRanking.model
    );
    const winnerKey = championIdx >= 0 ? modelKeys[championIdx] : 'modelA';

    const sanitizeResponse = (r: BattleResponse | null) => {
      if (!r) return { content: '[No response]', responseTime: 0 };
      return {
        content: r.content || (r.error ? `[Error] ${r.error}` : '[No response]'),
        responseTime: r.responseTime,
        specificModel: r.specificModel,
        error: r.error,
      };
    };

    // Build ratings from rankings
    const ratingsMap: Record<string, { accuracy: number; creativity: number; clarity: number; total: number }> = {};
    for (let i = 0; i < allFighters.length; i++) {
      const ranking = finalRankings.find(
        (r) => r.provider === allFighters[i].provider && r.model === allFighters[i].model
      );
      ratingsMap[modelKeys[i]] = ranking?.ratings || { accuracy: 0, creativity: 0, clarity: 0, total: 0 };
    }

    const body: Record<string, unknown> = {
      challengeId: challenge?.id || 'custom',
      challengeName: challenge?.name || 'Custom Challenge',
      prompt: battlePrompt,
      battleType: 'royale',
      modelA: { provider: allFighters[0].provider, model: allFighters[0].model },
      modelB: { provider: allFighters[1].provider, model: allFighters[1].model },
      modelC: { provider: allFighters[2].provider, model: allFighters[2].model },
      modelD: { provider: allFighters[3].provider, model: allFighters[3].model },
      responseA: sanitizeResponse(responses[0]),
      responseB: sanitizeResponse(responses[1]),
      responseC: sanitizeResponse(responses[2]),
      responseD: sanitizeResponse(responses[3]),
      ratings: ratingsMap,
      winner: winnerKey,
      rankings: finalRankings.map((r) => ({
        model: r.model,
        provider: r.provider,
        rank: r.rank,
        score: r.score,
      })),
    };

    try {
      const res = await fetch('/api/battle/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setBattleState('results');
    } catch {
      setSaveStatus('error');
    }
  };

  // --- Leaderboard & History ---

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/battle/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // ignore
    }
    setLeaderboardLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/battle/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // ignore
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchLeaderboard, fetchHistory]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearInterval);
    };
  }, []);

  // --- Reset ---

  const resetBattle = () => {
    setBattleState('setup');
    setResponses([null, null]);
    setElapsedTimes([0, 0]);
    setRatingsA(emptyRatings());
    setRatingsB(emptyRatings());
    setRatingsC(emptyRatings());
    setRatingsD(emptyRatings());
    setWinner(null);
    setBlindfoldRevealed(false);
    setShowBlindfoldReveal(false);
    setRoyaleRankings(null);
    setRoyalePrompts([]);
    setSaveStatus('idle');
    setBattlePrompt('');
  };

  // --- Leaderboard sorting ---

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const dir = leaderboardSort.dir === 'asc' ? 1 : -1;
    switch (leaderboardSort.key) {
      case 'winRate': {
        const rateA = a.totalBattles > 0 ? a.wins / a.totalBattles : 0;
        const rateB = b.totalBattles > 0 ? b.wins / b.totalBattles : 0;
        return (rateA - rateB) * dir;
      }
      case 'wins':
        return (a.wins - b.wins) * dir;
      case 'totalBattles':
        return (a.totalBattles - b.totalBattles) * dir;
      case 'avgTotal':
        return (a.avgTotal - b.avgTotal) * dir;
      default:
        return 0;
    }
  });

  const toggleSort = (key: string) => {
    setLeaderboardSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    );
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          {[
            { id: 'battle' as ActiveTab, label: 'Battle', icon: <Swords className="h-4 w-4" /> },
            { id: 'leaderboard' as ActiveTab, label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
            { id: 'history' as ActiveTab, label: 'History', icon: <History className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-600/30 to-amber-600/30 text-orange-300 border border-orange-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ==================== BATTLE TAB ==================== */}
          {activeTab === 'battle' && (
            <motion.div
              key="battle"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* --- SETUP STATE --- */}
              {battleState === 'setup' && (
                <div>
                  {/* Header */}
                  <div className="text-center mb-10">
                    <h1
                      className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-orange-400 via-amber-400 to-red-400 bg-clip-text text-transparent"
                      style={{ textShadow: '0 0 40px rgba(249, 115, 22, 0.3)' }}
                    >
                      AI BATTLE ARENA
                    </h1>
                    <p className="text-slate-400">Pit AI models against each other in epic challenges</p>
                  </div>

                  {/* Fighter Cards (hidden for Royale — auto-selects all 4 providers) */}
                  {!isRoyale && (
                    <>
                      <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
                        <FighterCard
                          fighter={fighterA}
                          setFighter={setFighterA}
                          label="Fighter A"
                          onProviderChange={handleProviderChange}
                        />

                        {/* VS Badge */}
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="flex-shrink-0"
                        >
                          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-full h-14 w-14 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-500/30">
                            VS
                          </div>
                        </motion.div>

                        <FighterCard
                          fighter={fighterB}
                          setFighter={setFighterB}
                          label="Fighter B"
                          onProviderChange={handleProviderChange}
                        />
                      </div>

                      {/* Random Matchup */}
                      <div className="text-center mb-8">
                        <button
                          onClick={handleRandomMatchup}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white hover:border-orange-500/40 transition-all text-sm"
                        >
                          <Shuffle className="h-4 w-4" />
                          Random Matchup
                        </button>
                      </div>
                    </>
                  )}

                  {/* Royale Info Banner — shows auto-selected models */}
                  {isRoyale && (
                    <div className="mb-8 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Crown className="h-5 w-5 text-amber-400" />
                        <span className="font-bold text-amber-300 text-sm">Battle Royale — one model from each provider</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {providers.map((p) => (
                          <div
                            key={p}
                            className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5"
                          >
                            <div className={`h-2 w-2 rounded-full ${providerColorDots[p]}`} />
                            <span className="text-xs text-slate-400">{providerDisplayNames[p]}:</span>
                            <span className="text-xs font-medium text-white">
                              {specificModelDisplayNames[defaultModels[p] as keyof typeof specificModelDisplayNames] || defaultModels[p]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Challenge Grid */}
                  <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Choose Your Challenge</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {BATTLE_CHALLENGES.map((challenge) => {
                        const isSelected = selectedChallenge?.id === challenge.id && !useCustomPrompt;
                        const isMindGames = challenge.category === 'Mind Games';
                        const hoverClass = isMindGames
                          ? 'hover:border-violet-500/40 hover:bg-violet-500/5'
                          : 'hover:border-amber-500/40 hover:bg-amber-500/5';
                        return (
                        <motion.button
                          key={challenge.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedChallenge(challenge);
                            setUseCustomPrompt(false);
                          }}
                          className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                            isSelected
                              ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/20 ring-1 ring-orange-500/30'
                              : `bg-slate-900/40 border-slate-700/50 ${hoverClass}`
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{challenge.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white text-sm">{challenge.name}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    challenge.category === 'Mind Games'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-purple-500/20 text-purple-300'
                                  }`}
                                >
                                  {challenge.category}
                                </span>
                                {challenge.special && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-500/20 text-red-300">
                                    {challenge.special === 'blindfold' ? 'Blindfold' : challenge.special === 'royale' ? 'Royale' : 'Live Code'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2">
                                {challenge.description}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                        );
                      })}

                      {/* Custom Prompt Card */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setUseCustomPrompt(true);
                          setSelectedChallenge(null);
                        }}
                        className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                          useCustomPrompt
                            ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10'
                            : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">✏️</span>
                          <div>
                            <span className="font-medium text-white text-sm">Custom Prompt</span>
                            <p className="text-xs text-slate-400 mt-1">Write your own challenge</p>
                          </div>
                        </div>
                      </motion.button>
                    </div>

                    {/* Custom Prompt Textarea */}
                    <AnimatePresence>
                      {useCustomPrompt && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4"
                        >
                          <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Enter your custom battle prompt..."
                            rows={3}
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors resize-none"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Start Battle Button */}
                  <div className="text-center">
                    <motion.button
                      whileHover={canStartBattle ? { scale: 1.05 } : {}}
                      whileTap={canStartBattle ? { scale: 0.95 } : {}}
                      onClick={startBattle}
                      disabled={!canStartBattle}
                      className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 ${
                        canStartBattle
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Flame className="h-5 w-5" />
                      START BATTLE
                    </motion.button>
                  </div>
                </div>
              )}

              {/* --- BATTLING STATE --- */}
              {battleState === 'battling' && (
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                  >
                    <motion.h2
                      animate={{ textShadow: ['0 0 20px rgba(245, 158, 11, 0.3)', '0 0 40px rgba(245, 158, 11, 0.6)', '0 0 20px rgba(245, 158, 11, 0.3)'] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-2xl md:text-3xl font-black text-amber-400 mb-2"
                    >
                      ⚔️ BATTLE IN PROGRESS
                    </motion.h2>
                    <p className="text-sm font-medium text-orange-300/80 mb-1">
                      {selectedChallenge?.name || 'Custom Challenge'}
                    </p>
                    {selectedChallenge?.userDescription && (
                      <p className="text-sm italic text-slate-400 mb-1">
                        {selectedChallenge.userDescription}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 max-w-2xl mx-auto line-clamp-2">
                      {battlePrompt}
                    </p>
                  </motion.div>

                  <div className={`grid gap-4 ${isRoyale ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} relative`}>
                    {(isRoyale ? [0, 1, 2, 3] : [0, 1]).map((idx) => {
                      const fighter = idx === 0 ? fighterA : idx === 1 ? fighterB : { provider: providers[idx] as LLMProvider, model: defaultModels[providers[idx]] };
                      const response = responses[idx];
                      const label = isBlindfold ? `Mystery ${String.fromCharCode(65 + idx)}` : getDisplayName(fighter.provider, fighter.model);

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            borderColor: response && !response.error
                              ? ['rgba(16, 185, 129, 0.6)', 'rgba(16, 185, 129, 0.6)', 'rgba(51, 65, 85, 0.5)']
                              : 'rgba(51, 65, 85, 0.5)',
                          }}
                          transition={{ delay: idx * 0.1, borderColor: { duration: 1.5, times: [0, 0.3, 1] } }}
                          className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {isBlindfold ? (
                                <EyeOff className="h-4 w-4 text-slate-400" />
                              ) : (
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                    providerColorDots[fighter.provider as LLMProvider] || 'bg-slate-500'
                                  }`}
                                />
                              )}
                              <span className="font-medium text-white text-sm">{label}</span>
                              {!isBlindfold && fighter.provider && (
                                <span
                                  className={`text-xs ${
                                    modelColors[fighter.provider as LLMProvider] || 'text-slate-400'
                                  }`}
                                >
                                  {providerDisplayNames[fighter.provider as LLMProvider]}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              {elapsedTimes[idx]?.toFixed(1)}s
                            </div>
                          </div>

                          {/* Progress / Response */}
                          {!response ? (
                            <div className="space-y-3">
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-full"
                                  initial={{ width: '0%' }}
                                  animate={{ width: '100%' }}
                                  transition={{ duration: 45, ease: 'linear' }}
                                />
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                />
                              </div>
                              <p className="text-sm text-amber-400/80 animate-pulse">Generating response...</p>
                            </div>
                          ) : response.error ? (
                            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
                              Error: {response.error}
                            </div>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-slate-300 max-h-96 overflow-y-auto scroll-smooth leading-relaxed"
                            >
                              <MarkdownResponse content={response.content} />
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* --- JUDGING STATE --- */}
              {battleState === 'judging' && (
                <>
                  {/* Code Duel: special judging with live code execution */}
                  {isCodeDuel ? (
                    <CodeDuelJudging
                      responses={responses}
                      fighterA={fighterA}
                      fighterB={fighterB}
                      winner={winner}
                      setWinner={setWinner}
                      onSubmitVote={submitVote}
                      saveStatus={saveStatus}
                      challengeName={selectedChallenge?.name}
                      challengeDescription={selectedChallenge?.userDescription}
                      prompt={battlePrompt}
                    />
                  ) : isRoyale ? (
                    /* Battle Royale: multi-round elimination */
                    <BattleRoyaleArena
                      responses={responses}
                      fighters={providers.map((p) => ({ provider: p, model: defaultModels[p] }))}
                      prompts={royalePrompts.length > 0 ? royalePrompts : [battlePrompt]}
                      challengeDescription={selectedChallenge?.userDescription}
                      fetchNextRound={fetchRoundResponses}
                      onChampionCrowned={handleRoyaleComplete}
                    />
                  ) : (
                    /* Standard / Blindfold judging */
                    <div>
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-8"
                      >
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Trophy className="h-6 w-6 text-amber-400" />
                          <h2 className="text-2xl font-bold text-white">WHO WINS?</h2>
                          <Trophy className="h-6 w-6 text-amber-400" />
                        </div>
                        <p className="text-sm text-slate-400">Read both responses and pick a winner</p>
                        {selectedChallenge && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-orange-300/80">
                              {selectedChallenge.name}
                            </p>
                            {selectedChallenge.userDescription && (
                              <p className="text-xs italic text-slate-400 mt-0.5">
                                {selectedChallenge.userDescription}
                              </p>
                            )}
                          </div>
                        )}
                        {battlePrompt && (
                          <div className="mt-2 bg-slate-800/40 border border-slate-700/30 rounded-lg px-4 py-2 max-w-2xl mx-auto">
                            <span className="text-xs text-slate-500 font-medium">Mission: </span>
                            <span className="text-xs text-slate-300">{battlePrompt}</span>
                          </div>
                        )}
                      </motion.div>

                      {/* Response Cards */}
                      <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-2">
                        {[0, 1].map((idx) => {
                          const keys = ['A', 'B'] as const;
                          const key = keys[idx];
                          const fighter = idx === 0 ? fighterA : fighterB;
                          const response = responses[idx];
                          const showName = !isBlindfold || blindfoldRevealed;
                          const label = showName
                            ? getDisplayName(fighter.provider, fighter.model)
                            : `Mystery ${key}`;

                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={`bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-5 transition-all ${
                                winner === `model${key}`
                                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                  : 'border-slate-700/50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  {showName ? (
                                    <div
                                      className={`h-2 w-2 rounded-full ${
                                        providerColorDots[fighter.provider as LLMProvider] || 'bg-slate-500'
                                      }`}
                                    />
                                  ) : (
                                    <EyeOff className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className="font-medium text-white text-sm">{label}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Clock className="h-3 w-3" />
                                  {response ? `${(response.responseTime / 1000).toFixed(1)}s` : '-'}
                                </div>
                              </div>

                              {/* Response */}
                              <div className="text-sm text-slate-300 max-h-96 overflow-y-auto scroll-smooth leading-relaxed bg-slate-800/40 rounded-lg p-3">
                                {response?.error ? (
                                  <span className="text-red-400">Error: {response.error}</span>
                                ) : response?.content ? (
                                  <MarkdownResponse content={response.content} />
                                ) : (
                                  <span className="text-slate-500">No response</span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Vote Buttons */}
                      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                        {(['modelA', 'modelB'] as const).map((key) => {
                          const idx = key === 'modelA' ? 0 : 1;
                          const fighter = idx === 0 ? fighterA : fighterB;
                          const label =
                            isBlindfold && !blindfoldRevealed
                              ? `Mystery ${String.fromCharCode(65 + idx)} Wins`
                              : `${getDisplayName(fighter.provider, fighter.model)} Wins`;

                          return (
                            <motion.button
                              key={key}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setWinner(key)}
                              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                                winner === key
                                  ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300'
                                  : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <Crown className="h-4 w-4 inline mr-1.5" />
                              {label}
                            </motion.button>
                          );
                        })}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setWinner('tie')}
                          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                            winner === 'tie'
                              ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-300'
                              : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          Tie
                        </motion.button>
                      </div>

                      {/* Submit Vote */}
                      <div className="text-center">
                        <motion.button
                          whileHover={winner ? { scale: 1.05 } : {}}
                          whileTap={winner ? { scale: 0.95 } : {}}
                          onClick={handleBlindfoldOrSubmit}
                          disabled={!winner || saveStatus === 'saving'}
                          className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base transition-all ${
                            winner
                              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {saveStatus === 'saving' ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </motion.div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Submit Vote
                            </>
                          )}
                        </motion.button>
                        {saveStatus === 'error' && (
                          <p className="text-sm text-red-400 mt-2">Failed to save. Try again.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Blindfold Reveal Overlay */}
                  {showBlindfoldReveal && (
                    <BlindfoldReveal
                      fighterA={fighterA}
                      fighterB={fighterB}
                      winner={winner!}
                      onComplete={() => {
                        setShowBlindfoldReveal(false);
                        setBlindfoldRevealed(true);
                        submitVote();
                      }}
                    />
                  )}
                </>
              )}

              {/* --- RESULTS STATE --- */}
              {battleState === 'results' && (
                <div className="text-center">
                  {/* Winner Announcement */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 150 }}
                    className="mb-10"
                  >
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 30px rgba(245, 158, 11, 0.2)',
                          '0 0 80px rgba(245, 158, 11, 0.5)',
                          '0 0 30px rgba(245, 158, 11, 0.2)',
                        ],
                      }}
                      transition={{ repeat: Infinity, duration: 2.5 }}
                      className="inline-block bg-gradient-to-b from-slate-900/80 to-slate-900/60 backdrop-blur-xl border border-amber-500/40 rounded-3xl px-12 py-10"
                    >
                      <motion.div
                        animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                      >
                        <Trophy className="h-16 w-16 text-amber-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                      </motion.div>
                      {winner === 'tie' ? (
                        <>
                          <h2 className="text-4xl md:text-5xl font-black text-amber-400 mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                            IT&apos;S A TIE!
                          </h2>
                          <p className="text-sm text-slate-400">Both fighters scored equally</p>
                        </>
                      ) : (
                        <>
                          <h2 className="text-4xl md:text-5xl font-black text-emerald-400 mb-3 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                            WINNER!
                          </h2>
                          <p className="text-2xl text-white font-bold mb-2">
                            {royaleRankings
                              ? getDisplayName(
                                  royaleRankings.find((r) => r.rank === 1)!.provider,
                                  royaleRankings.find((r) => r.rank === 1)!.model
                                )
                              : winner === 'modelA'
                              ? getDisplayName(fighterA.provider, fighterA.model)
                              : winner === 'modelB'
                              ? getDisplayName(fighterB.provider, fighterB.model)
                              : `Model ${winner?.replace('model', '')}`}
                          </p>
                          {(() => {
                            const winnerRatings = winner === 'modelA' ? ratingsA : ratingsB;
                            const loserRatings = winner === 'modelA' ? ratingsB : ratingsA;
                            const diff = winnerRatings.total - loserRatings.total;
                            return diff > 0 ? (
                              <p className="text-sm text-amber-400/80 font-medium">
                                Won by {diff} point{diff !== 1 ? 's' : ''}!
                              </p>
                            ) : null;
                          })()}
                        </>
                      )}
                    </motion.div>
                  </motion.div>

                  {/* Score Breakdown */}
                  {royaleRankings ? (
                    /* Battle Royale Rankings */
                    <div className="max-w-xl mx-auto mb-8 space-y-3">
                      {[...royaleRankings]
                        .sort((a, b) => a.rank - b.rank)
                        .map((r, idx) => {
                          const medal =
                            r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#4';
                          return (
                            <motion.div
                              key={r.rank}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + idx * 0.15 }}
                              className={`bg-slate-900/50 backdrop-blur-xl border rounded-xl p-4 flex items-center gap-4 ${
                                r.rank === 1
                                  ? 'border-amber-400/50 shadow-lg shadow-amber-500/20 ring-1 ring-amber-500/20'
                                  : 'border-slate-700/50'
                              }`}
                            >
                              <span className="text-2xl">{medal}</span>
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-medium text-sm ${r.rank === 1 ? 'text-amber-300' : 'text-white'}`}>
                                  {getDisplayName(r.provider, r.model)}
                                </h3>
                                <span className="text-xs text-slate-500">
                                  {providerDisplayNames[r.provider as LLMProvider] || r.provider}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-amber-400">{r.score}/15</span>
                            </motion.div>
                          );
                        })}
                    </div>
                  ) : (
                    /* Standard / Blindfold Score Breakdown */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
                      {[
                        { label: isBlindfold ? 'Fighter A' : getDisplayName(fighterA.provider, fighterA.model), ratings: ratingsA, isWinner: winner === 'modelA' },
                        { label: isBlindfold ? 'Fighter B' : getDisplayName(fighterB.provider, fighterB.model), ratings: ratingsB, isWinner: winner === 'modelB' },
                      ].map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + idx * 0.15 }}
                          className={`bg-slate-900/50 backdrop-blur-xl border rounded-xl p-4 transition-all ${
                            item.isWinner
                              ? 'border-amber-400/50 shadow-lg shadow-amber-500/20 ring-1 ring-amber-500/20'
                              : 'border-slate-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            {item.isWinner && <Crown className="h-4 w-4 text-amber-400" />}
                            <h3 className={`font-medium text-sm ${item.isWinner ? 'text-amber-300' : 'text-white'}`}>{item.label}</h3>
                          </div>
                          <div className="space-y-1 text-xs text-slate-400">
                            <div className="flex justify-between">
                              <span>{selectedChallenge?.ratingCategories?.[0] || 'Accuracy'}</span>
                              <span className="text-amber-400">{item.ratings.accuracy}/5</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{selectedChallenge?.ratingCategories?.[1] || 'Creativity'}</span>
                              <span className="text-amber-400">{item.ratings.creativity}/5</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{selectedChallenge?.ratingCategories?.[2] || 'Clarity'}</span>
                              <span className="text-amber-400">{item.ratings.clarity}/5</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-700/50 font-medium">
                              <span className="text-white">Total</span>
                              <span className="text-amber-400">{item.ratings.total}/15</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={resetBattle}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold shadow-lg shadow-orange-500/20"
                    >
                      <Swords className="h-4 w-4" />
                      New Battle
                    </motion.button>
                    <button
                      onClick={() => setActiveTab('leaderboard')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all font-medium"
                    >
                      <Trophy className="h-4 w-4" />
                      Leaderboard
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== LEADERBOARD TAB ==================== */}
          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Leaderboard</h2>

              {leaderboardLoading ? (
                <div className="text-center text-slate-400 py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="inline-block"
                  >
                    <RotateCcw className="h-6 w-6" />
                  </motion.div>
                  <p className="mt-2">Loading leaderboard...</p>
                </div>
              ) : sortedLeaderboard.length === 0 ? (
                <div className="text-center py-20">
                  <div className="relative inline-block mb-6">
                    <Trophy className="h-16 w-16 text-slate-700 mx-auto" />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ repeat: Infinity, duration: 2.5 }}
                      className="absolute -top-1 -right-1"
                    >
                      <Sparkles className="h-5 w-5 text-amber-500/60" />
                    </motion.div>
                    <Swords className="h-6 w-6 text-slate-600 absolute -bottom-1 -left-2 rotate-[-20deg]" />
                  </div>
                  <p className="text-lg font-semibold text-slate-300 mb-1">No battles yet</p>
                  <p className="text-slate-500 text-sm mb-6">Time to enter the arena!</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setActiveTab('battle');
                      resetBattle();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-shadow"
                  >
                    <Swords className="h-4 w-4" />
                    Start Your First Battle
                  </motion.button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700/50">
                        <th className="text-left py-3 px-3 font-medium">Rank</th>
                        <th className="text-left py-3 px-3 font-medium">Model</th>
                        <th className="text-left py-3 px-3 font-medium">Provider</th>
                        <th
                          className="text-center py-3 px-3 font-medium cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('wins')}
                        >
                          W/L/T {leaderboardSort.key === 'wins' && (leaderboardSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th
                          className="text-center py-3 px-3 font-medium cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('winRate')}
                        >
                          Win Rate {leaderboardSort.key === 'winRate' && (leaderboardSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th
                          className="text-center py-3 px-3 font-medium cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('avgTotal')}
                        >
                          Avg Score {leaderboardSort.key === 'avgTotal' && (leaderboardSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th
                          className="text-center py-3 px-3 font-medium cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('totalBattles')}
                        >
                          Battles {leaderboardSort.key === 'totalBattles' && (leaderboardSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeaderboard.map((entry, idx) => {
                        const winRate =
                          entry.totalBattles > 0
                            ? ((entry.wins / entry.totalBattles) * 100).toFixed(0)
                            : '0';
                        const rankBorder =
                          idx === 0
                            ? 'border-l-2 border-l-amber-400'
                            : idx === 1
                            ? 'border-l-2 border-l-slate-300'
                            : idx === 2
                            ? 'border-l-2 border-l-amber-700'
                            : '';

                        return (
                          <motion.tr
                            key={entry._id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${rankBorder}`}
                          >
                            <td className="py-3 px-3">
                              <span className="font-bold text-white">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-white font-medium">
                              {getDisplayName(entry.provider, entry.modelId)}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-xs ${
                                  modelColors[entry.provider as LLMProvider] || 'text-slate-400'
                                }`}
                              >
                                {providerDisplayNames[entry.provider as LLMProvider] || entry.provider}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-300">
                              <span className="text-emerald-400">{entry.wins}</span>
                              {' / '}
                              <span className="text-red-400">{entry.losses}</span>
                              {' / '}
                              <span className="text-amber-400">{entry.ties}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`font-medium ${
                                  Number(winRate) >= 60
                                    ? 'text-emerald-400'
                                    : Number(winRate) >= 40
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {winRate}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-300">
                              {entry.avgTotal.toFixed(1)}/15
                            </td>
                            <td className="py-3 px-3 text-center text-slate-400">
                              {entry.totalBattles}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== HISTORY TAB ==================== */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Battle History</h2>

              {historyLoading ? (
                <div className="text-center text-slate-400 py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="inline-block"
                  >
                    <RotateCcw className="h-6 w-6" />
                  </motion.div>
                  <p className="mt-2">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-20">
                  <div className="relative inline-block mb-6">
                    <ScrollText className="h-16 w-16 text-slate-700 mx-auto" />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-1 -right-2"
                    >
                      <Zap className="h-5 w-5 text-amber-500/60" />
                    </motion.div>
                    <Shield className="h-6 w-6 text-slate-600 absolute -bottom-1 -left-2" />
                  </div>
                  <p className="text-lg font-semibold text-slate-300 mb-1">No battle history yet</p>
                  <p className="text-slate-500 text-sm mb-6">Time to enter the arena!</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setActiveTab('battle');
                      resetBattle();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-shadow"
                  >
                    <Swords className="h-4 w-4" />
                    Start Your First Battle
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => {
                    const isExpanded = expandedHistoryId === entry._id;
                    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const winnerName =
                      entry.winner === 'tie'
                        ? 'Tie'
                        : entry.winner === 'modelA'
                        ? getDisplayName(entry.modelA.provider, entry.modelA.model)
                        : entry.winner === 'modelB'
                        ? getDisplayName(entry.modelB.provider, entry.modelB.model)
                        : `Model ${entry.winner.replace('model', '')}`;

                    return (
                      <motion.div
                        key={entry._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedHistoryId(isExpanded ? null : entry._id)
                          }
                          className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {date}
                            </span>
                            <span className="text-sm text-white font-medium truncate">
                              {getDisplayName(entry.modelA.provider, entry.modelA.model)}
                              <span className="text-slate-500 mx-2">vs</span>
                              {getDisplayName(entry.modelB.provider, entry.modelB.model)}
                            </span>
                            <span className="text-xs text-slate-400 hidden sm:inline">
                              {entry.challengeName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                entry.winner === 'tie'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {winnerName}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
                                <p className="text-xs text-slate-500 mb-3">
                                  <strong>Prompt:</strong> {entry.prompt}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Model A */}
                                  <div className="bg-slate-800/40 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-white">
                                        {getDisplayName(entry.modelA.provider, entry.modelA.model)}
                                      </span>
                                      <span className="text-xs text-amber-400">
                                        {entry.ratings.modelA.total}/15
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {entry.responseA.content}
                                    </p>
                                  </div>
                                  {/* Model B */}
                                  <div className="bg-slate-800/40 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-white">
                                        {getDisplayName(entry.modelB.provider, entry.modelB.model)}
                                      </span>
                                      <span className="text-xs text-amber-400">
                                        {entry.ratings.modelB.total}/15
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {entry.responseB.content}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
