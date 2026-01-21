'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, Loader2, FlaskConical, Check, X } from 'lucide-react';
import { CustomProvider } from '@/lib/custom-providers';
import {
  COMMON_CUSTOM_PROVIDERS,
  getSuggestedModels,
  getHeaderType,
  normalizeBaseUrl,
} from '@/lib/llm/models';
import { testCustomProviderConnection } from '@/lib/llm/custom';

interface CustomProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: CustomProvider | null; // null = add mode, provider = edit mode
  onSave: (provider: Omit<CustomProvider, 'id'> & { id?: string }) => void;
}

type TestStatus = 'idle' | 'testing' | 'valid' | 'invalid';

export default function CustomProviderModal({
  open,
  onOpenChange,
  provider,
  onSave,
}: CustomProviderModalProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');
  const [suggestedModels, setSuggestedModels] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal opens/closes or provider changes
  useEffect(() => {
    if (open) {
      if (provider) {
        // Edit mode
        setName(provider.name);
        setBaseUrl(provider.baseUrl);
        setApiKey(provider.apiKey);
        setModelId(provider.modelId);
      } else {
        // Add mode
        setName('');
        setBaseUrl('');
        setApiKey('');
        setModelId('');
      }
      setShowApiKey(false);
      setTestStatus('idle');
      setTestError('');
    }
  }, [open, provider]);

  // Update suggested models when base URL changes
  useEffect(() => {
    if (baseUrl) {
      const models = getSuggestedModels(baseUrl);
      setSuggestedModels(models);
    } else {
      setSuggestedModels([]);
    }
  }, [baseUrl]);

  const handleQuickFill = (providerName: string) => {
    const suggestion = COMMON_CUSTOM_PROVIDERS.find((p) => p.name === providerName);
    if (suggestion) {
      setName(suggestion.name);
      setBaseUrl(suggestion.baseUrl);
      setModelId(suggestion.models[0] || '');
    }
  };

  const handleTest = async () => {
    if (!baseUrl || !apiKey || !modelId) {
      setTestError('Please fill in all required fields');
      setTestStatus('invalid');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    const testProvider: CustomProvider = {
      id: 'test',
      name: name || 'Test',
      baseUrl,
      apiKey,
      modelId,
      enabled: true,
      headerType: getHeaderType(baseUrl),
    };

    const result = await testCustomProviderConnection(testProvider);

    if (result.valid) {
      setTestStatus('valid');
    } else {
      setTestStatus('invalid');
      setTestError(result.error || 'Connection failed');
    }
  };

  const handleSave = () => {
    if (!name || !baseUrl || !apiKey || !modelId) {
      return;
    }

    onSave({
      ...(provider?.id && { id: provider.id }),
      name,
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey,
      modelId,
      enabled: provider?.enabled ?? true,
      headerType: getHeaderType(baseUrl),
    });

    onOpenChange(false);
  };

  const isValid = name && baseUrl && apiKey && modelId;
  const isEditMode = !!provider;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {isEditMode ? 'Edit Custom Provider' : 'Add Custom Provider'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditMode
              ? 'Update the provider configuration.'
              : 'Add an OpenAI-compatible API provider.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Fill Suggestions */}
          {!isEditMode && (
            <div>
              <label className="text-xs text-slate-500 mb-2 block">
                Quick fill from common providers
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_CUSTOM_PROVIDERS.slice(0, 4).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleQuickFill(p.name)}
                    className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provider Name */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              Provider Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., OpenAI, Anthropic"
              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              API Base URL
            </label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g., https://api.openai.com/v1"
              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
            />
            <p className="text-xs text-slate-500 mt-1">
              The base URL for the API (without /chat/completions)
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              API Key
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestStatus('idle');
                }}
                placeholder="Enter your API key"
                className="pr-10 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Model ID */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              Model ID
            </label>
            {mounted && suggestedModels.length > 0 ? (
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="bg-slate-950 border-slate-700">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {suggestedModels.map((model) => (
                    <SelectItem
                      key={model}
                      value={model}
                      className="text-slate-300 focus:bg-slate-800"
                    >
                      {model}
                    </SelectItem>
                  ))}
                  <SelectItem
                    value="__custom__"
                    className="text-slate-400 focus:bg-slate-800"
                  >
                    Enter custom model...
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g., gpt-4-turbo, claude-3-opus-20240229"
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
            )}
            {modelId === '__custom__' && (
              <Input
                value=""
                onChange={(e) => setModelId(e.target.value)}
                placeholder="Enter custom model ID"
                className="mt-2 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
                autoFocus
              />
            )}
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testStatus === 'testing' || !isValid}
              className={`transition-colors ${
                testStatus === 'valid'
                  ? 'border-emerald-500/50 text-emerald-400'
                  : testStatus === 'invalid'
                  ? 'border-rose-500/50 text-rose-400'
                  : 'border-slate-600'
              }`}
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : testStatus === 'valid' ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Connected
                </>
              ) : testStatus === 'invalid' ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Failed
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            {testError && (
              <span className="text-xs text-rose-400 truncate" title={testError}>
                {testError}
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
          >
            {isEditMode ? 'Save Changes' : 'Add Provider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
