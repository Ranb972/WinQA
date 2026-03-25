'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { LLMProvider, SpecificModel, modelDisplayNames, fallbackChains, specificModelDisplayNames } from '@/lib/llm';
import { CustomProvider } from '@/lib/custom-providers';
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
  customProviders?: CustomProvider[];
  selectedCustomProviders?: string[];
  onModelChange?: (model: LLMProvider) => void;
  onModelsChange?: (models: LLMProvider[]) => void;
  onModeChange?: (mode: 'single' | 'multi') => void;
  onModelPreferenceChange?: (provider: LLMProvider, model: SpecificModel) => void;
  onCustomProvidersChange?: (ids: string[]) => void;
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
  customProviders = [],
  selectedCustomProviders = [],
  onModelChange,
  onModelsChange,
  onModeChange,
  onModelPreferenceChange,
  onCustomProvidersChange,
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

  const handleCustomProviderSelect = (id: string, checked: boolean) => {
    if (checked) {
      onCustomProvidersChange?.([...selectedCustomProviders, id]);
    } else {
      onCustomProvidersChange?.(selectedCustomProviders.filter((i) => i !== id));
    }
  };

  const ModelGearPopover = ({ provider }: { provider: LLMProvider }) => {
    const availableModels = fallbackChains[provider] || [];
    const currentModel = modelPreferences[provider] || availableModels[0];

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="p-1 rounded hover:bg-white/[0.06] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings className="h-3 w-3 text-slate-500 hover:text-slate-300" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3 bg-white/[0.02] border-white/[0.06]"
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
                        ? 'bg-orange-500/20 border border-orange-500/30'
                        : 'hover:bg-white/[0.06]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full border-2',
                          isSelected
                            ? 'border-orange-500 bg-orange-500'
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onModeChange?.('single')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
            mode === 'single'
              ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30'
              : 'text-zinc-400 hover:text-slate-300'
          )}
        >
          Single
        </button>
        <button
          onClick={() => onModeChange?.('multi')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
            mode === 'multi'
              ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30'
              : 'text-zinc-400 hover:text-slate-300'
          )}
        >
          Compare
        </button>
      </div>

      {/* Single Model Selector */}
      {mode === 'single' && mounted && (
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={(v) => onModelChange?.(v as LLMProvider)}>
            <SelectTrigger className="w-full sm:w-48 bg-white/[0.02] border-white/[0.06]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-white/[0.02] border-white/[0.06]">
              {providers.map((provider) => (
                <SelectItem
                  key={provider}
                  value={provider}
                  className="text-zinc-400 focus:bg-white/[0.06] focus:text-slate-100"
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Built-in providers */}
          {providers.map((provider) => (
            <div key={provider} className="flex items-center gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedModels.includes(provider)}
                  onCheckedChange={(checked) =>
                    handleMultiSelect(provider, checked as boolean)
                  }
                  className="border-white/[0.06] data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <span
                  className={cn(
                    'px-1.5 sm:px-2 py-0.5 rounded text-xs border whitespace-nowrap',
                    modelBadgeColors[provider]
                  )}
                >
                  {modelDisplayNames[provider]}
                </span>
              </label>
              <ModelGearPopover provider={provider} />
            </div>
          ))}

          {/* Custom providers */}
          {customProviders.length > 0 && (
            <>
              <div className="w-px h-5 bg-white/[0.06] mx-1" />
              {customProviders.map((provider) => (
                <div key={provider.id} className="flex items-center gap-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCustomProviders.includes(provider.id)}
                      onCheckedChange={(checked) =>
                        handleCustomProviderSelect(provider.id, checked as boolean)
                      }
                      className="border-white/[0.06] data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-xs border bg-orange-500/20 text-orange-500 border-orange-500/30 whitespace-nowrap truncate max-w-[100px] sm:max-w-none">
                      {provider.name}
                    </span>
                  </label>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
