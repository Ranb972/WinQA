'use client';

import { useState } from 'react';
import { Search, X, Target } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LLMProvider, providerDisplayNames } from '@/lib/llm';
import { CustomProvider } from '@/lib/custom-providers';
import { PROVIDER_MODELS, getDefaultModel } from '@/lib/llm/models';

export type DebugMode = 'summary' | 'detailed';
export type AnalysisType = 'debug' | 'success';

interface DebugModelSelectorProps {
  onSelect: (model: LLMProvider | string, mode: DebugMode) => void;
  onClose: () => void;
  customProviders?: CustomProvider[];
  analysisType?: AnalysisType;
}

// Built-in providers with their default models for display
const BUILT_IN_OPTIONS: { value: LLMProvider; label: string; description: string }[] = [
  {
    value: 'groq',
    label: 'Groq - Llama 3.3 70B',
    description: 'Fast inference (Recommended)',
  },
  {
    value: 'gemini',
    label: 'Gemini 2.0 Flash',
    description: 'Google AI',
  },
  {
    value: 'cohere',
    label: 'Cohere Command A',
    description: 'Latest Cohere model',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter - DeepSeek R1',
    description: 'Free tier',
  },
];

export default function DebugModelSelector({
  onSelect,
  onClose,
  customProviders,
  analysisType = 'debug',
}: DebugModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<string>('groq');
  const [debugMode, setDebugMode] = useState<DebugMode>('summary');

  const enabledCustomProviders = customProviders?.filter((p) => p.enabled) || [];
  const isSuccess = analysisType === 'success';

  const handleAnalyze = () => {
    onSelect(selectedModel, debugMode);
  };

  return (
    <div className="mt-3 p-4 border border-white/[0.08] bg-[#070707] relative animate-fade-in">
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-orange-500" />
      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-orange-500" />

      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] mb-3">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <Target className="w-[13px] h-[13px] text-orange-500" />
          ) : (
            <Search className="w-[13px] h-[13px] text-orange-500" />
          )}
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-white">
            {isSuccess ? 'What Worked? Analysis' : 'AI Debug Analysis'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-3">
        {isSuccess
          ? 'Select a model to analyze what worked in your code:'
          : 'Select a model to analyze the error and suggest fixes:'}
      </p>

      <Select value={selectedModel} onValueChange={setSelectedModel}>
        <SelectTrigger className="w-full flex items-center justify-between px-3 py-2.5 border border-white/[0.08] bg-white/[0.02] hover:border-orange-500/25 transition-colors text-left mb-3">
          <SelectValue placeholder="Choose model" />
        </SelectTrigger>
        <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
          {/* Built-in providers */}
          {BUILT_IN_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-zinc-300 focus:bg-white/[0.04]"
            >
              <div className="flex flex-col">
                <span className="font-mono text-xs text-white">{option.label}</span>
                <span className="font-mono text-[10px] text-orange-500/60">{option.description}</span>
              </div>
            </SelectItem>
          ))}

          {/* Custom providers separator */}
          {enabledCustomProviders.length > 0 && (
            <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 border-t border-white/[0.06] mt-1">
              Custom Providers
            </div>
          )}

          {/* Custom providers */}
          {enabledCustomProviders.map((provider) => (
            <SelectItem
              key={provider.id}
              value={`custom:${provider.id}`}
              className="text-zinc-300 focus:bg-white/[0.04]"
            >
              <div className="flex flex-col">
                <span className="font-mono text-xs text-white">{provider.name}</span>
                <span className="font-mono text-[10px] text-orange-500/60">{provider.modelId}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">Output format:</p>
        <div className="flex gap-2">
          <button
            onClick={() => setDebugMode('summary')}
            className={debugMode === 'summary'
              ? 'px-4 py-1.5 bg-orange-500 text-black font-mono text-[10px] uppercase tracking-[0.12em] font-semibold transition-colors'
              : 'px-4 py-1.5 border border-white/[0.1] text-zinc-400 hover:text-white hover:border-orange-500/30 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors'}
          >
            Summary
          </button>
          <button
            onClick={() => setDebugMode('detailed')}
            className={debugMode === 'detailed'
              ? 'px-4 py-1.5 bg-orange-500 text-black font-mono text-[10px] uppercase tracking-[0.12em] font-semibold transition-colors'
              : 'px-4 py-1.5 border border-white/[0.1] text-zinc-400 hover:text-white hover:border-orange-500/30 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors'}
          >
            Detailed
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.14em] font-semibold transition-colors"
        >
          {isSuccess ? 'Analyze Code' : 'Analyze Error'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
