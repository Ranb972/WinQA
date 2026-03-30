'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Eye,
  EyeOff,
  Check,
  Info,
  Save,
  Trash2,
  Shield,
  ChevronDown,
  Loader2,
  X,
  FlaskConical,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MotionWrapper } from '@/components/ui/motion-wrapper';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getApiKeys, setApiKeys, maskApiKey, ApiKeys } from '@/lib/api-keys';
import { LLMProvider } from '@/lib/llm/types';
import { PROVIDER_MODELS, getDefaultModel } from '@/lib/llm/models';
import { getModelPreferences, setModelPreference, ModelPreferences } from '@/lib/model-preferences';
import {
  CustomProvider,
  getCustomProviders,
  saveCustomProviders,
  removeCustomProvider,
  toggleCustomProvider,
  MAX_CUSTOM_PROVIDERS,
} from '@/lib/custom-providers';
import { testCustomProviderConnection } from '@/lib/llm/custom';
import CustomProviderCard from '@/components/CustomProviderCard';
import CustomProviderModal from '@/components/CustomProviderModal';
import { useToast } from '@/hooks/use-toast';

interface ProviderConfig {
  key: LLMProvider;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
}

const providers: ProviderConfig[] = [
  {
    key: 'cohere',
    name: 'Cohere',
    description: 'Access Command R+ and other Cohere models',
    placeholder: 'Enter your Cohere API key',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
  },
  {
    key: 'gemini',
    name: 'Google Gemini',
    description: 'Access Gemini 2.5 Flash and other Google models',
    placeholder: 'Enter your Google AI API key',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    key: 'groq',
    name: 'Groq',
    description: 'Access Llama 3.3 70B and other fast models',
    placeholder: 'Enter your Groq API key',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    description: 'Access DeepSeek R1 and many other models',
    placeholder: 'Enter your OpenRouter API key',
    docsUrl: 'https://openrouter.ai/keys',
  },
];

type TestStatus = 'idle' | 'testing' | 'valid' | 'invalid';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [keys, setKeysState] = useState<ApiKeys>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<ApiKeys>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const { toast } = useToast();

  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [modelPreferences, setModelPreferencesState] = useState<ModelPreferences>({});
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<Record<string, unknown> | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!isLoaded) return;

      setIsLoading(true);
      try {
        const stored = await getApiKeys(user?.id);
        setKeysState(stored);
        setSavedKeys(stored);
        const prefs = getModelPreferences();
        setModelPreferencesState(prefs);
        const providers = await getCustomProviders(user?.id);
        setCustomProviders(providers);
      } catch {
        // Error loading data, start fresh
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [isLoaded, user?.id]);

  const toggleVisibility = (provider: string) => {
    setVisibility((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleKeyChange = (provider: LLMProvider, value: string) => {
    setKeysState((prev) => ({ ...prev, [provider]: value }));
    setTestStatus((prev) => ({ ...prev, [provider]: 'idle' }));
    setTestErrors((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
  };

  const handleClearKey = (provider: LLMProvider) => {
    setKeysState((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
    setTestStatus((prev) => ({ ...prev, [provider]: 'idle' }));
    setTestErrors((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
  };

  const handleFocus = (provider: string) => {
    setEditing((prev) => ({ ...prev, [provider]: true }));
  };

  const handleBlur = (provider: string) => {
    setEditing((prev) => ({ ...prev, [provider]: false }));
  };

  const handleTestKey = async (provider: LLMProvider) => {
    const apiKey = keys[provider];
    if (!apiKey) return;

    setTestStatus((prev) => ({ ...prev, [provider]: 'testing' }));
    setTestErrors((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });

    try {
      const response = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const result = await response.json();

      if (result.valid) {
        setTestStatus((prev) => ({ ...prev, [provider]: 'valid' }));
      } else {
        setTestStatus((prev) => ({ ...prev, [provider]: 'invalid' }));
        setTestErrors((prev) => ({ ...prev, [provider]: result.error || 'Invalid key' }));
      }
    } catch {
      setTestStatus((prev) => ({ ...prev, [provider]: 'invalid' }));
      setTestErrors((prev) => ({ ...prev, [provider]: 'Failed to test key' }));
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await setApiKeys(keys, user?.id);
      setSavedKeys(keys);
      toast({
        title: 'Settings saved',
        description: 'API keys saved and encrypted!',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save keys',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(keys) !== JSON.stringify(savedKeys);
  const hasAnyKey = Object.values(savedKeys).some((k) => k && k.trim());

  const handleModelChange = (provider: LLMProvider, modelId: string) => {
    setModelPreference(provider, modelId);
    setModelPreferencesState((prev) => ({ ...prev, [provider]: modelId }));
  };

  const handleSaveProvider = async (
    providerData: Omit<CustomProvider, 'id'> & { id?: string }
  ) => {
    if (providerData.id) {
      const updated = customProviders.map((p) =>
        p.id === providerData.id ? { ...p, ...providerData } : p
      );
      await saveCustomProviders(updated as CustomProvider[], user?.id);
      setCustomProviders(updated as CustomProvider[]);
      toast({
        title: 'Provider updated',
        description: `${providerData.name} has been updated`,
        variant: 'success',
      });
    } else {
      const newProvider: CustomProvider = {
        ...providerData,
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };
      const updated = [...customProviders, newProvider];
      await saveCustomProviders(updated, user?.id);
      setCustomProviders(updated);
      toast({
        title: 'Provider added',
        description: `${providerData.name} has been added`,
        variant: 'success',
      });
    }
    setShowAddModal(false);
    setEditingProvider(null);
  };

  const handleDeleteProvider = async (id: string) => {
    await removeCustomProvider(id, user?.id);
    setCustomProviders((prev) => prev.filter((p) => p.id !== id));
  };

  const handleToggleProvider = async (id: string) => {
    await toggleCustomProvider(id, user?.id);
    setCustomProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleTestCustomProvider = async (
    provider: CustomProvider
  ): Promise<{ valid: boolean; error?: string }> => {
    return testCustomProviderConnection(provider);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('Export failed');

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `winqa-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: 'Your data has been downloaded',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Export failed',
        description: 'Failed to export data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.version || !data.data) {
          throw new Error('Invalid format');
        }
        setPendingImportData(data);
      } catch {
        toast({
          title: 'Invalid file',
          description: 'The file is not a valid WinQA export',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = (mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      setShowReplaceWarning(true);
      return;
    }
    executeImport(mode);
  };

  const executeImport = async (mode: 'merge' | 'replace') => {
    setIsImporting(true);
    setShowReplaceWarning(false);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: pendingImportData, mode }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      const total = result.imported.bugs + result.imported.prompts +
                    result.imported.testCases + result.imported.insights;

      toast({
        title: 'Import complete',
        description: `Imported ${total} items (${result.imported.bugs} bugs, ${result.imported.prompts} prompts, ${result.imported.testCases} test cases, ${result.imported.insights} insights)`,
        variant: 'success',
      });

      setPendingImportData(null);
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import data',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getDisplayValue = (provider: LLMProvider) => {
    const value = keys[provider] || '';
    const isEditing = editing[provider];
    const isVisible = visibility[provider];

    if (isEditing || isVisible) {
      return value;
    }

    if (savedKeys[provider] && !isEditing) {
      return maskApiKey(savedKeys[provider]!);
    }

    return value;
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          <span className="font-mono text-xs uppercase tracking-[0.12em]">Loading settings...</span>
        </div>
      </div>
    );
  }

  const calibratedCount = Object.values(savedKeys).filter((k) => k && k.trim()).length;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <MotionWrapper>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold uppercase tracking-wider text-white">Settings</h1>
              <p className="text-zinc-400 text-sm mt-1">Investigation parameters</p>
            </div>
          </div>
        </MotionWrapper>

        {/* Info Banner */}
        <MotionWrapper delay={0.1}>
          <div className="relative p-4 rounded bg-white/[0.015] border border-white/[0.06] overflow-hidden mb-8">
            <div className="absolute top-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute top-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 right-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-[2px] h-4 bg-orange-500" />
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-zinc-400 text-sm">
                  <span className="text-orange-500 font-medium">Configure your authentication credentials</span> for higher rate limits and better reliability.
                  Your credentials are <span className="text-orange-500 font-medium">encrypted</span> before being stored locally in your browser.
                </p>
              </div>
            </div>
          </div>
        </MotionWrapper>

        {/* API Keys Section */}
        <MotionWrapper delay={0.2}>
          <div className="relative rounded bg-white/[0.015] border border-white/[0.06] overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute top-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 right-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-[2px] h-4 bg-orange-500" />

            {/* Section Header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white">Authentication Credentials</h2>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{calibratedCount}/{providers.length} Calibrated</span>
            </div>

            {/* Credential Rows */}
            <div>
              {providers.map((provider, index) => {
                const currentValue = keys[provider.key] || '';
                const isSaved = savedKeys[provider.key] && savedKeys[provider.key]!.trim().length > 0;
                const isVisible = visibility[provider.key];
                const status = testStatus[provider.key] || 'idle';
                const error = testErrors[provider.key];
                const isEditing = editing[provider.key];

                return (
                  <motion.div
                    key={provider.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index, duration: 0.3 }}
                    className="p-5 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                          <Settings className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <label className="text-white font-medium text-sm">
                              {provider.name}
                            </label>
                            {isSaved && status === 'idle' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="h-2.5 w-2.5" />
                                Calibrated
                              </span>
                            )}
                            {!isSaved && status === 'idle' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                                Uncalibrated
                              </span>
                            )}
                            {status === 'valid' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="h-2.5 w-2.5" />
                                Valid
                              </span>
                            )}
                            {status === 'invalid' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                <X className="h-2.5 w-2.5" />
                                Invalid
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-500 text-xs mt-0.5">{provider.description}</p>
                        </div>
                      </div>
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-orange-500 text-xs font-mono uppercase tracking-[0.15em] hover:text-orange-400 transition-colors"
                      >
                        Acquire Key
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="mt-3">
                      <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-white/40 mb-1.5">Authentication Key</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={isVisible || isEditing ? 'text' : 'password'}
                            value={isEditing ? currentValue : getDisplayValue(provider.key)}
                            onChange={(e) => handleKeyChange(provider.key, e.target.value)}
                            onFocus={() => handleFocus(provider.key)}
                            onBlur={() => handleBlur(provider.key)}
                            placeholder={provider.placeholder}
                            className="pr-10 h-10 bg-black border-white/[0.08] text-white font-mono text-sm placeholder:text-white/20 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(provider.key)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                          >
                            {isVisible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {currentValue && (
                          <button
                            onClick={() => handleTestKey(provider.key)}
                            disabled={status === 'testing'}
                            className={`h-10 w-10 rounded flex items-center justify-center transition-colors ${
                              status === 'valid'
                                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                                : status === 'invalid'
                                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                : 'text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10'
                            }`}
                            title="Test API key"
                          >
                            {status === 'testing' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FlaskConical className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        {currentValue && (
                          <button
                            onClick={() => handleClearKey(provider.key)}
                            className="h-10 w-10 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Clear API key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-red-400 mt-2 font-mono"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {PROVIDER_MODELS[provider.key] && (
                      <div className="mt-3">
                        <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-white/40 mb-1.5">
                          Model Configuration
                        </label>
                        <Select
                          value={modelPreferences[provider.key] || getDefaultModel(provider.key) || ''}
                          onValueChange={(v) => handleModelChange(provider.key, v)}
                        >
                          <SelectTrigger className="bg-black border-white/[0.08] h-10 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                            {PROVIDER_MODELS[provider.key].map((model) => (
                              <SelectItem
                                key={model.id}
                                value={model.id}
                                className="text-zinc-400 focus:bg-white/[0.04] text-sm"
                              >
                                {model.name}
                                {model.default && (
                                  <span className="text-white/30 ml-1">(Default)</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="flex justify-center pt-6 px-5 pb-5">
              <button
                onClick={handleSaveAll}
                disabled={!hasChanges || isSaving}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-black text-xs font-mono uppercase tracking-[0.15em] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Securing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Credentials
                  </>
                )}
              </button>
            </div>
          </div>
        </MotionWrapper>

        {/* Custom Providers Section */}
        <MotionWrapper delay={0.25}>
          <div className="relative rounded bg-white/[0.015] border border-white/[0.06] overflow-hidden mt-6">
            <div className="absolute top-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute top-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 right-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-[2px] h-4 bg-orange-500" />

            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white">Connected Sources</h2>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{customProviders.length}/{MAX_CUSTOM_PROVIDERS} Active</span>
            </div>

            <div className="px-5 py-4">
              <p className="flex items-center gap-2 text-zinc-500 text-sm mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
                Connect OpenAI-compatible intelligence sources (max {MAX_CUSTOM_PROVIDERS})
              </p>

              {customProviders.length > 0 && (
                <div className="space-y-3 mb-4">
                  <AnimatePresence>
                    {customProviders.map((provider) => (
                      <CustomProviderCard
                        key={provider.id}
                        provider={provider}
                        onEdit={() => setEditingProvider(provider)}
                        onDelete={() => handleDeleteProvider(provider.id)}
                        onTest={() => handleTestCustomProvider(provider)}
                        onToggle={() => handleToggleProvider(provider.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {customProviders.length === 0 && (
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/25 text-center py-4 mb-4">
                  No intelligence sources connected
                </p>
              )}

              {customProviders.length < MAX_CUSTOM_PROVIDERS && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded border border-dashed border-white/[0.08] text-zinc-500 hover:text-white hover:border-orange-500/30 font-mono text-xs uppercase tracking-[0.15em] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Connect New Source
                </button>
              )}

              {customProviders.length >= MAX_CUSTOM_PROVIDERS && (
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/25 text-center">
                  Maximum {MAX_CUSTOM_PROVIDERS} sources connected
                </p>
              )}
            </div>
          </div>
        </MotionWrapper>

        <CustomProviderModal
          open={showAddModal || !!editingProvider}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddModal(false);
              setEditingProvider(null);
            }
          }}
          provider={editingProvider}
          onSave={handleSaveProvider}
        />

        {/* Export/Import Section */}
        <MotionWrapper delay={0.27}>
          <div className="relative rounded bg-white/[0.015] border border-white/[0.06] overflow-hidden mt-6">
            <div className="absolute top-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute top-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute top-0 right-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 left-0 w-[2px] h-4 bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-4 h-[2px] bg-orange-500" />
            <div className="absolute bottom-0 right-0 w-[2px] h-4 bg-orange-500" />

            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white">Evidence Transfer</h2>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="flex items-center gap-2 text-zinc-500 text-sm mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
                Backup case files or restore from previous archives
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="group flex flex-col items-center gap-3 p-6 rounded bg-white/[0.02] border border-white/[0.08] hover:border-orange-500/30 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded bg-white/[0.05] border border-white/[0.08] flex items-center justify-center group-hover:border-orange-500/30 transition-colors">
                    {isExporting ? (
                      <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    ) : (
                      <Download className="w-5 h-5 text-zinc-400 group-hover:text-orange-500 transition-colors" />
                    )}
                  </div>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-400 group-hover:text-white transition-colors">Export Case Files</span>
                </button>

                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                    disabled={isImporting}
                  />
                  <div className="group flex flex-col items-center gap-3 p-6 rounded bg-white/[0.02] border border-white/[0.08] hover:border-orange-500/30 transition-colors">
                    <div className="w-12 h-12 rounded bg-white/[0.05] border border-white/[0.08] flex items-center justify-center group-hover:border-orange-500/30 transition-colors">
                      {isImporting ? (
                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                      ) : (
                        <Upload className="w-5 h-5 text-zinc-400 group-hover:text-orange-500 transition-colors" />
                      )}
                    </div>
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-400 group-hover:text-white transition-colors">Import Case Files</span>
                  </div>
                </label>
              </div>

              {pendingImportData && (
                <div className="mt-4 p-4 rounded bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-sm text-zinc-400 mb-3">How should evidence be processed?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleImport('merge')}
                      disabled={isImporting}
                      className="flex-1 px-4 py-2 rounded border border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] hover:border-green-500/50 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors"
                    >
                      Merge (Add to existing files)
                    </button>
                    <button
                      onClick={() => handleImport('replace')}
                      disabled={isImporting}
                      className="flex-1 px-4 py-2 rounded border border-red-900/40 bg-red-950/25 text-red-400 hover:bg-red-950/40 font-mono text-xs uppercase tracking-[0.12em] transition-colors"
                    >
                      Replace (Purge and rebuild)
                    </button>
                  </div>
                  <button
                    onClick={() => setPendingImportData(null)}
                    className="w-full mt-2 py-2 text-zinc-500 hover:text-white font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/40 text-center mt-4">
                Includes: incident logs, techniques, cases, and findings
              </p>
            </div>
          </div>
        </MotionWrapper>

        {/* Replace Warning Dialog */}
        <AlertDialog open={showReplaceWarning} onOpenChange={setShowReplaceWarning}>
          <AlertDialogContent className="bg-black border border-white/[0.08]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-400 font-mono text-xs uppercase tracking-[0.16em]">
                <AlertTriangle className="h-5 w-5" />
                Replace all data?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-zinc-400">
                This will permanently delete all your existing bugs, prompts, test cases, and insights before importing the new data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/[0.06] text-zinc-400 hover:bg-white/[0.02] font-mono text-xs uppercase tracking-[0.12em]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => executeImport('replace')}
                className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs uppercase tracking-[0.12em]"
              >
                Yes, replace all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Security Info - Collapsible */}
        <MotionWrapper delay={0.3}>
          <div className="mt-6">
            <button
              onClick={() => setSecurityExpanded(!securityExpanded)}
              className="w-full p-4 bg-white/[0.02] border border-white/[0.06] rounded hover:border-white/[0.12] transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-green-400" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">Security Information</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-white/30 transition-transform ${
                  securityExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {securityExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 mt-2 bg-green-500/5 border border-green-500/20 rounded">
                    <ul className="text-xs text-zinc-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are encrypted with <span className="text-green-400">AES-256-GCM</span> before storage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Encryption key is derived from your unique user ID using <span className="text-green-400">PBKDF2</span></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are stored only in your browser&apos;s localStorage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are <span className="text-green-400">never saved</span> to our database</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are transmitted over <span className="text-green-400">HTTPS</span> only</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>You can delete your keys anytime</span>
                      </li>
                    </ul>
                    <p className="font-mono text-[10px] text-white/25 mt-4 pt-3 border-t border-white/[0.06]">
                      Your keys are as secure as your browser and device. Clear your browser data to remove all stored keys.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </MotionWrapper>

        {/* Usage Info */}
        <MotionWrapper delay={0.4}>
          <div className="mt-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-4 bg-orange-500/50 rounded-full" />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Operating Procedures</h3>
            </div>
            <ul className="text-xs text-zinc-500 space-y-1 ml-4">
              <li>Click the <FlaskConical className="h-3 w-3 inline" /> button to test if your API key is valid</li>
              <li>Keys are sent with each request to use your own rate limits</li>
              <li>If no custom key is set, the app uses default shared keys (with lower limits)</li>
              <li>Keys are masked by default - click the eye icon or focus the field to reveal</li>
            </ul>
          </div>
        </MotionWrapper>
      </div>
    </div>
  );
}
