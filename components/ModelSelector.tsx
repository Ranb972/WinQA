'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { LLMProvider, SpecificModel, modelDisplayNames, fallbackChains, specificModelDisplayNames } from '@/lib/llm';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  mode: 'single' | 'multi';
  selectedModel?: LLMProvider;
  selectedModels?: LLMProvider[];
  modelPreferences?: Record<LLMProvider, SpecificModel>;
  onModelChange?: (model: LLMProvider) => void;
  onModelsChange?: (models: LLMProvider[]) => void;
  onModeChange?: (mode: 'single' | 'multi') => void;
  onModelPreferenceChange?: (provider: LLMProvider, model: SpecificModel) => void;
}

const providers: LLMProvider[] = ['cohere', 'gemini', 'groq', 'openrouter'];

const modelBadgeColors: Record<LLMProvider, string> = {
  cohere: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  gemini: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  groq: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  openrouter: 'bg-green-600/20 text-green-400 border-green-600/30',
};

const modelDescriptions: Record<string, string> = {
  // Cohere
  'command-a-03-2025': 'Newest, strongest',
  'command-r-plus-08-2024': 'Very capable',
  'command-r-08-2024': 'Balanced',
  'command-r7b-12-2024': 'Smallest, fastest',
  // Gemini
  'gemini-2.5-flash': 'Latest, most capable',
  'gemini-2.0-flash': 'Fast and capable',
  'gemini-2.5-flash-lite': 'Lightweight',
  // Groq
  'llama-3.3-70b-versatile': 'Most capable',
  'llama-3.1-8b-instant': 'Faster, smaller',
  // OpenRouter
  'deepseek/deepseek-r1-0528:free': 'DeepSeek R1 (free)',
  'tngtech/deepseek-r1t-chimera:free': 'DeepSeek R1T (free)',
  'tngtech/deepseek-r1t2-chimera:free': 'DeepSeek R1T2 (free)',
};

export default function ModelSelector({
  mode,
  selectedModel = 'cohere',
  selectedModels = [],
  modelPreferences = {} as Record<LLMProvider, SpecificModel>,
  onModelChange,
  onModelsChange,
  onModeChange,
  onModelPreferenceChange,
}: ModelSelectorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMultiSelect = (model: LLMProvider, checked: boolean) => {
    if (checked) {
      onModelsChange?.([...selectedModels, model]);
    } else {
      onModelsChange?.(selectedModels.filter((m) => m !== model));
    }
  };

  const ModelGearPopover = ({ provider }: { provider: LLMProvider }) => {
    const availableModels = fallbackChains[provider] || [];
    const currentModel = modelPreferences[provider] || availableModels[0];

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="p-1 rounded hover:bg-slate-700/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings className="h-3 w-3 text-slate-500 hover:text-slate-300" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3 bg-slate-900 border-slate-700"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-200">
              Select {modelDisplayNames[provider]} Model
            </div>
            <div className="space-y-1">
              {availableModels.map((model) => {
                const isSelected = currentModel === model;
                const displayName = specificModelDisplayNames[model] || model;
                const description = modelDescriptions[model] || '';
                const isDefault = model === availableModels[0];

                return (
                  <button
                    key={model}
                    onClick={() => onModelPreferenceChange?.(provider, model)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg transition-colors',
                      isSelected
                        ? 'bg-emerald-600/20 border border-emerald-600/30'
                        : 'hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full border-2',
                          isSelected
                            ? 'border-emerald-400 bg-emerald-400'
                            : 'border-slate-500'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">
                          {displayName}
                          {isDefault && (
                            <span className="ml-2 text-xs text-slate-500">(default)</span>
                          )}
                        </div>
                        {description && (
                          <div className="text-xs text-slate-500">{description}</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="flex items-center gap-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onModeChange?.('single')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            mode === 'single'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
              : 'text-slate-400 hover:text-slate-300'
          )}
        >
          Single
        </button>
        <button
          onClick={() => onModeChange?.('multi')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            mode === 'multi'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
              : 'text-slate-400 hover:text-slate-300'
          )}
        >
          Compare
        </button>
      </div>

      {/* Single Model Selector */}
      {mode === 'single' && mounted && (
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={(v) => onModelChange?.(v as LLMProvider)}>
            <SelectTrigger className="w-48 bg-slate-900 border-slate-700">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {providers.map((provider) => (
                <SelectItem
                  key={provider}
                  value={provider}
                  className="text-slate-300 focus:bg-slate-800 focus:text-slate-100"
                >
                  <span className={cn('px-2 py-0.5 rounded text-xs border', modelBadgeColors[provider])}>
                    {modelDisplayNames[provider]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ModelGearPopover provider={selectedModel} />
        </div>
      )}

      {/* Multi Model Selector */}
      {mode === 'multi' && (
        <div className="flex items-center gap-3">
          {providers.map((provider) => (
            <div key={provider} className="flex items-center gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedModels.includes(provider)}
                  onCheckedChange={(checked) =>
                    handleMultiSelect(provider, checked as boolean)
                  }
                  className="border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs border',
                    modelBadgeColors[provider]
                  )}
                >
                  {modelDisplayNames[provider]}
                </span>
              </label>
              <ModelGearPopover provider={provider} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
