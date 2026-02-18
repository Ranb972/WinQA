'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  RotateCcw,
  Crown,
  Sparkles,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  PlayCircle,
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

interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
}

type Winner = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'tie';

interface CodeDuelJudgingProps {
  responses: (BattleResponse | null)[];
  fighterA: FighterConfig;
  fighterB: FighterConfig;
  winner: Winner | null;
  setWinner: (w: Winner) => void;
  onSubmitVote: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  challengeName?: string;
  challengeDescription?: string;
  prompt?: string;
}

// --- Helpers ---

const providerColorDots: Record<LLMProvider, string> = {
  cohere: 'bg-purple-400',
  gemini: 'bg-blue-400',
  groq: 'bg-orange-400',
  openrouter: 'bg-green-400',
};

function getDisplayName(provider: string, model: string): string {
  if (specificModelDisplayNames[model as keyof typeof specificModelDisplayNames]) {
    return specificModelDisplayNames[model as keyof typeof specificModelDisplayNames];
  }
  const providerModels = PROVIDER_MODELS[provider as LLMProvider];
  const found = providerModels?.find((m) => m.id === model);
  return found?.name || model || provider;
}

function extractCodeBlock(content: string): string | null {
  // Try javascript/js tagged blocks first
  const jsMatch = content.match(/```(?:javascript|js)\s*\n([\s\S]*?)```/);
  if (jsMatch) return jsMatch[1].trim();
  // Try any code block
  const genericMatch = content.match(/```\s*\n([\s\S]*?)```/);
  if (genericMatch) return genericMatch[1].trim();
  return null;
}

// --- Sub-components ---

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
        h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-white mb-1.5">{children}</h2>
        ),
        h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// --- Main Component ---

export default function CodeDuelJudging({
  responses,
  fighterA,
  fighterB,
  winner,
  setWinner,
  onSubmitVote,
  saveStatus,
  challengeName,
  challengeDescription,
  prompt,
}: CodeDuelJudgingProps) {
  const [extractedCodes, setExtractedCodes] = useState<(string | null)[]>([null, null]);
  const [codeOutputs, setCodeOutputs] = useState<(CodeExecutionResult | null)[]>([null, null]);
  const [runningCode, setRunningCode] = useState<boolean[]>([false, false]);

  // Extract code blocks on mount
  useEffect(() => {
    const codes = [
      responses[0]?.content ? extractCodeBlock(responses[0].content) : null,
      responses[1]?.content ? extractCodeBlock(responses[1].content) : null,
    ];
    setExtractedCodes(codes);
  }, [responses]);

  const runCode = useCallback(
    async (idx: number) => {
      const code = extractedCodes[idx];
      if (!code) return;

      setRunningCode((prev) => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });
      setCodeOutputs((prev) => {
        const next = [...prev];
        next[idx] = null;
        return next;
      });

      try {
        const res = await fetch('/api/execute-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language: 'javascript' }),
        });
        const result: CodeExecutionResult = await res.json();
        setCodeOutputs((prev) => {
          const next = [...prev];
          next[idx] = result;
          return next;
        });
      } catch {
        setCodeOutputs((prev) => {
          const next = [...prev];
          next[idx] = { success: false, error: 'Failed to execute code' };
          return next;
        });
      } finally {
        setRunningCode((prev) => {
          const next = [...prev];
          next[idx] = false;
          return next;
        });
      }
    },
    [extractedCodes]
  );

  const runBoth = useCallback(() => {
    if (extractedCodes[0]) runCode(0);
    if (extractedCodes[1]) runCode(1);
  }, [extractedCodes, runCode]);

  // Determine comparison result
  const bothRan = codeOutputs[0] !== null && codeOutputs[1] !== null;
  const comparisonResult = bothRan
    ? codeOutputs[0]!.success && codeOutputs[1]!.success
      ? (codeOutputs[0]!.output?.trim() || '') === (codeOutputs[1]!.output?.trim() || '')
        ? 'both-correct'
        : 'different'
      : codeOutputs[0]!.success && !codeOutputs[1]!.success
      ? 'b-error'
      : !codeOutputs[0]!.success && codeOutputs[1]!.success
      ? 'a-error'
      : 'both-error'
    : null;

  const fighters = [fighterA, fighterB];

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-2xl">⚔️</span>
          <h2 className="text-2xl font-bold text-white">CODE DUEL</h2>
          <span className="text-2xl">⚔️</span>
        </div>
        <p className="text-sm text-slate-400">
          Review the code, run it live, then judge the results
        </p>
        {challengeDescription && (
          <p className="text-xs italic text-slate-400 mt-1">
            {challengeDescription}
          </p>
        )}
        {prompt && (
          <div className="mt-2 bg-slate-800/40 border border-slate-700/30 rounded-lg px-4 py-2 max-w-2xl mx-auto">
            <span className="text-xs text-slate-500 font-medium">Mission: </span>
            <span className="text-xs text-slate-300 line-clamp-2">{prompt}</span>
          </div>
        )}
      </motion.div>

      {/* Run Both Button */}
      <div className="text-center mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={runBoth}
          disabled={(!extractedCodes[0] && !extractedCodes[1]) || (runningCode[0] && runningCode[1])}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlayCircle className="h-4 w-4" />
          Run Both
        </motion.button>
      </div>

      {/* Response Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {[0, 1].map((idx) => {
          const fighter = fighters[idx];
          const response = responses[idx];
          const code = extractedCodes[idx];
          const output = codeOutputs[idx];
          const running = runningCode[idx];
          const modelKey = idx === 0 ? 'modelA' : 'modelB';
          const label = getDisplayName(fighter.provider, fighter.model);

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-5 transition-all ${
                winner === modelKey
                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'border-slate-700/50'
              }`}
            >
              {/* Model Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      providerColorDots[fighter.provider as LLMProvider] || 'bg-slate-500'
                    }`}
                  />
                  <span className="font-medium text-white text-sm">{label}</span>
                  {fighter.provider && (
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
                  {response ? `${(response.responseTime / 1000).toFixed(1)}s` : '-'}
                </div>
              </div>

              {/* Response Content */}
              <div className="text-sm text-slate-300 max-h-72 overflow-y-auto scroll-smooth leading-relaxed mb-4 bg-slate-800/40 rounded-lg p-3">
                {response?.error ? (
                  <span className="text-red-400">Error: {response.error}</span>
                ) : response?.content ? (
                  <MarkdownResponse content={response.content} />
                ) : (
                  <span className="text-slate-500">No response</span>
                )}
              </div>

              {/* Run Code Button */}
              <div className="mb-4">
                {code ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => runCode(idx)}
                    disabled={running}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-sm hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    {running ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </motion.div>
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        RUN CODE
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="w-full px-4 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-slate-500 text-sm text-center">
                    No code block detected
                  </div>
                )}
              </div>

              {/* Execution Output */}
              <AnimatePresence>
                {output && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <div className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Output
                    </div>
                    <div
                      className={`rounded-lg overflow-hidden border-l-4 ${
                        output.success
                          ? 'border-l-emerald-500 bg-emerald-500/5'
                          : 'border-l-red-500 bg-red-500/5'
                      }`}
                    >
                      <pre className="p-3 text-xs font-mono overflow-x-auto bg-slate-950 text-slate-200 max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {output.success
                          ? output.output || '(no output)'
                          : output.error || 'Unknown error'}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          );
        })}
      </div>

      {/* Auto-comparison Banner */}
      <AnimatePresence>
        {comparisonResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6"
          >
            <div
              className={`rounded-xl p-4 text-center font-medium text-sm border ${
                comparisonResult === 'both-correct'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : comparisonResult === 'different'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : comparisonResult === 'both-error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {comparisonResult === 'both-correct' && (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Both produced matching output
                  </>
                )}
                {comparisonResult === 'different' && (
                  <>
                    <AlertTriangle className="h-5 w-5" />
                    Different outputs detected!
                  </>
                )}
                {comparisonResult === 'a-error' && (
                  <>
                    <XCircle className="h-5 w-5" />
                    {getDisplayName(fighterA.provider, fighterA.model)} had an error
                  </>
                )}
                {comparisonResult === 'b-error' && (
                  <>
                    <XCircle className="h-5 w-5" />
                    {getDisplayName(fighterB.provider, fighterB.model)} had an error
                  </>
                )}
                {comparisonResult === 'both-error' && (
                  <>
                    <XCircle className="h-5 w-5" />
                    Both models had errors
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vote Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {(['modelA', 'modelB'] as const).map((key, idx) => {
          const fighter = fighters[idx];
          const label = `${getDisplayName(fighter.provider, fighter.model)} Wins`;
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
          onClick={onSubmitVote}
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
  );
}
