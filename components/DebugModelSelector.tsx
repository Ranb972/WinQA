'use client';

import { useState } from 'react';
import { Search, X, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="glass-card rounded-lg p-4 mt-3 border border-slate-700 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <Target className="h-4 w-4 text-emerald-400" />
          ) : (
            <Search className="h-4 w-4 text-purple-400" />
          )}
          <span className="text-sm font-medium text-slate-200">
            {isSuccess ? 'What Worked? Analysis' : 'AI Debug Analysis'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        {isSuccess
          ? 'Select a model to analyze what worked in your code:'
          : 'Select a model to analyze the error and suggest fixes:'}
      </p>

      <Select value={selectedModel} onValueChange={setSelectedModel}>
        <SelectTrigger className="bg-slate-900/50 border-slate-700 mb-3">
          <SelectValue placeholder="Choose model" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700">
          {/* Built-in providers */}
          {BUILT_IN_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-slate-300 focus:bg-slate-800"
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-slate-500">{option.description}</span>
              </div>
            </SelectItem>
          ))}

          {/* Custom providers separator */}
          {enabledCustomProviders.length > 0 && (
            <div className="px-2 py-1.5 text-xs text-slate-500 border-t border-slate-700 mt-1">
              Custom Providers
            </div>
          )}

          {/* Custom providers */}
          {enabledCustomProviders.map((provider) => (
            <SelectItem
              key={provider.id}
              value={`custom:${provider.id}`}
              className="text-slate-300 focus:bg-slate-800"
            >
              <div className="flex flex-col">
                <span>{provider.name}</span>
                <span className="text-xs text-slate-500">{provider.modelId}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mb-3">
        <p className="text-xs text-slate-400 mb-2">Output format:</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={debugMode === 'summary' ? 'default' : 'outline'}
            onClick={() => setDebugMode('summary')}
            className={debugMode === 'summary'
              ? `${isSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-purple-600 hover:bg-purple-500'} text-white text-xs h-7`
              : 'border-slate-600 text-slate-400 hover:text-slate-200 text-xs h-7'}
          >
            Summary
          </Button>
          <Button
            size="sm"
            variant={debugMode === 'detailed' ? 'default' : 'outline'}
            onClick={() => setDebugMode('detailed')}
            className={debugMode === 'detailed'
              ? `${isSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-purple-600 hover:bg-purple-500'} text-white text-xs h-7`
              : 'border-slate-600 text-slate-400 hover:text-slate-200 text-xs h-7'}
          >
            Detailed
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleAnalyze}
          size="sm"
          className={`flex-1 bg-gradient-to-r ${
            isSuccess
              ? 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
              : 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
          }`}
        >
          {isSuccess ? 'Analyze Code' : 'Analyze Error'}
        </Button>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-slate-200"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
