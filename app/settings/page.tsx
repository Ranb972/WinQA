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
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
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

  // Test status per provider
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  // Track which fields are being edited (show full key vs masked)
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  // Model preferences state
  const [modelPreferences, setModelPreferencesState] = useState<ModelPreferences>({});

  // Custom providers state
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);

  // Export/Import state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<Record<string, unknown> | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);

  // Load keys, model preferences, and custom providers on mount
  useEffect(() => {
    async function loadData() {
      if (!isLoaded) return;

      setIsLoading(true);
      try {
        // Load API keys
        const stored = await getApiKeys(user?.id);
        setKeysState(stored);
        setSavedKeys(stored);

        // Load model preferences
        const prefs = getModelPreferences();
        setModelPreferencesState(prefs);

        // Load custom providers
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
    // Clear test status when key changes
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

  // Handle model preference change
  const handleModelChange = (provider: LLMProvider, modelId: string) => {
    setModelPreference(provider, modelId);
    setModelPreferencesState((prev) => ({ ...prev, [provider]: modelId }));
  };

  // Handle custom provider save (add or update)
  const handleSaveProvider = async (
    providerData: Omit<CustomProvider, 'id'> & { id?: string }
  ) => {
    if (providerData.id) {
      // Update existing
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
      // Add new
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

  // Handle custom provider delete
  const handleDeleteProvider = async (id: string) => {
    await removeCustomProvider(id, user?.id);
    setCustomProviders((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle custom provider toggle
  const handleToggleProvider = async (id: string) => {
    await toggleCustomProvider(id, user?.id);
    setCustomProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  // Handle custom provider test
  const handleTestCustomProvider = async (
    provider: CustomProvider
  ): Promise<{ valid: boolean; error?: string }> => {
    return testCustomProviderConnection(provider);
  };

  // Handle data export
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

  // Handle import file selection
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Basic validation
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
    e.target.value = ''; // Reset input
  };

  // Handle import mode selection
  const handleImport = (mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      setShowReplaceWarning(true);
      return;
    }
    executeImport(mode);
  };

  // Execute the actual import
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

  // Display value: show masked unless editing or visibility toggled
  const getDisplayValue = (provider: LLMProvider) => {
    const value = keys[provider] || '';
    const isEditing = editing[provider];
    const isVisible = visibility[provider];

    // If editing or visibility toggled, show actual value
    if (isEditing || isVisible) {
      return value;
    }

    // If saved and has value, show masked
    if (savedKeys[provider] && !isEditing) {
      return maskApiKey(savedKeys[provider]!);
    }

    return value;
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <MotionWrapper>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/30">
              <Settings className="h-6 w-6 text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
          </div>
          <p className="text-slate-400 mb-8 ml-1">
            Manage your personal API keys and preferences
          </p>
        </MotionWrapper>

        {/* Info Banner */}
        <MotionWrapper delay={0.1}>
          <div className="glass-card rounded-xl p-4 mb-8 border border-blue-500/20 bg-blue-500/5">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-300">
                  <span className="font-medium text-blue-400">Add your own API keys</span> for higher rate limits and better reliability.
                  Your keys are <span className="text-emerald-400 font-medium">encrypted</span> before being stored locally in your browser.
                </p>
              </div>
            </div>
          </div>
        </MotionWrapper>

        {/* API Keys Section */}
        <MotionWrapper delay={0.2}>
          <div className="glass-card rounded-2xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
              <span className="text-2xl">🔑</span> API Keys
            </h2>

            <div className="space-y-6">
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
                    className="group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-200">
                          {provider.name}
                        </label>
                        {isSaved && status === 'idle' && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <Check className="h-3 w-3" />
                            Configured
                          </span>
                        )}
                        {status === 'valid' && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <Check className="h-3 w-3" />
                            Valid
                          </span>
                        )}
                        {status === 'invalid' && (
                          <span className="flex items-center gap-1 text-xs text-rose-400">
                            <X className="h-3 w-3" />
                            Invalid
                          </span>
                        )}
                      </div>
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        Get API Key →
                      </a>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{provider.description}</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={isVisible || isEditing ? 'text' : 'password'}
                          value={isEditing ? currentValue : getDisplayValue(provider.key)}
                          onChange={(e) => handleKeyChange(provider.key, e.target.value)}
                          onFocus={() => handleFocus(provider.key)}
                          onBlur={() => handleBlur(provider.key)}
                          placeholder={provider.placeholder}
                          className="pr-10 bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-violet-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => toggleVisibility(provider.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Test Button */}
                      {currentValue && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTestKey(provider.key)}
                          disabled={status === 'testing'}
                          className={`transition-colors ${
                            status === 'valid'
                              ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                              : status === 'invalid'
                              ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                              : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'
                          }`}
                          title="Test API key"
                        >
                          {status === 'testing' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FlaskConical className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {/* Clear Button */}
                      {currentValue && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleClearKey(provider.key)}
                          className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Clear API key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-rose-400 mt-2"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Model Selection Dropdown */}
                    {PROVIDER_MODELS[provider.key] && (
                      <div className="mt-3">
                        <label className="text-xs text-slate-500 mb-1 block">
                          Model
                        </label>
                        <Select
                          value={modelPreferences[provider.key] || getDefaultModel(provider.key) || ''}
                          onValueChange={(v) => handleModelChange(provider.key, v)}
                        >
                          <SelectTrigger className="bg-slate-900/50 border-slate-700 h-8 text-sm">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {PROVIDER_MODELS[provider.key].map((model) => (
                              <SelectItem
                                key={model.id}
                                value={model.id}
                                className="text-slate-300 focus:bg-slate-800 text-sm"
                              >
                                {model.name}
                                {model.default && (
                                  <span className="text-slate-500 ml-1">(Default)</span>
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
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm">
                {hasAnyKey && (
                  <span className="text-slate-500">
                    {Object.values(savedKeys).filter((k) => k && k.trim()).length} of {providers.length} keys configured
                  </span>
                )}
              </div>
              <Button
                onClick={handleSaveAll}
                disabled={!hasChanges || isSaving}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Encrypting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save All Keys
                  </>
                )}
              </Button>
            </div>
          </div>
        </MotionWrapper>

        {/* Custom Providers Section */}
        <MotionWrapper delay={0.25}>
          <div className="glass-card rounded-2xl p-6 border border-slate-700/50 mt-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-2 flex items-center gap-2">
              <span className="text-2xl">🔌</span> Custom Providers
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Add OpenAI-compatible API providers (max {MAX_CUSTOM_PROVIDERS})
            </p>

            {/* List existing custom providers */}
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

            {/* Empty state */}
            {customProviders.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4 mb-4">
                No custom providers configured. Add providers like OpenAI, Anthropic, or any OpenAI-compatible API.
              </p>
            )}

            {/* Add button (disabled if at max) */}
            {customProviders.length < MAX_CUSTOM_PROVIDERS && (
              <Button
                onClick={() => setShowAddModal(true)}
                variant="outline"
                className="w-full border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Provider
              </Button>
            )}

            {customProviders.length >= MAX_CUSTOM_PROVIDERS && (
              <p className="text-xs text-slate-500 text-center">
                Maximum {MAX_CUSTOM_PROVIDERS} custom providers reached
              </p>
            )}
          </div>
        </MotionWrapper>

        {/* Custom Provider Modal */}
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
          <div className="glass-card rounded-2xl p-6 border border-slate-700/50 mt-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-2 flex items-center gap-2">
              <span className="text-2xl">💾</span> Export / Import Data
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Backup your data or restore from a previous export
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export Button */}
              <Button
                onClick={handleExport}
                disabled={isExporting}
                variant="outline"
                className="h-20 flex-col gap-2 border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/10"
              >
                {isExporting ? (
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                ) : (
                  <Download className="h-6 w-6 text-emerald-400" />
                )}
                <span className="text-slate-300">Export Data</span>
              </Button>

              {/* Import Button */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                  disabled={isImporting}
                />
                <div className="h-20 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-600 rounded-md hover:border-blue-500/50 hover:bg-blue-500/10 transition-colors">
                  {isImporting ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  ) : (
                    <Upload className="h-6 w-6 text-blue-400" />
                  )}
                  <span className="text-slate-300">Import Data</span>
                </div>
              </label>
            </div>

            {/* Import Mode Selection */}
            {pendingImportData && (
              <div className="mt-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                <p className="text-sm text-slate-300 mb-3">How would you like to import?</p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleImport('merge')}
                    disabled={isImporting}
                    variant="outline"
                    className="flex-1 border-slate-600 hover:border-emerald-500/50"
                  >
                    Merge (Add to existing)
                  </Button>
                  <Button
                    onClick={() => handleImport('replace')}
                    disabled={isImporting}
                    variant="outline"
                    className="flex-1 border-slate-600 hover:border-rose-500/50 text-rose-400"
                  >
                    Replace (Delete existing)
                  </Button>
                </div>
                <Button
                  onClick={() => setPendingImportData(null)}
                  variant="ghost"
                  className="w-full mt-2 text-slate-500"
                >
                  Cancel
                </Button>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-4">
              Export includes: bugs, prompts, test cases, and insights
            </p>
          </div>
        </MotionWrapper>

        {/* Replace Warning Dialog */}
        <AlertDialog open={showReplaceWarning} onOpenChange={setShowReplaceWarning}>
          <AlertDialogContent className="glass border-slate-700/50 bg-slate-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
                Replace all data?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                This will permanently delete all your existing bugs, prompts, test cases, and insights before importing the new data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => executeImport('replace')}
                className="bg-rose-600 hover:bg-rose-500 text-white"
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
              className="w-full p-4 rounded-xl bg-slate-900/30 border border-slate-800/50 hover:border-slate-700/50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">Security Information</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
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
                  <div className="p-4 mt-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <ul className="text-xs text-slate-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are encrypted with <span className="text-emerald-400">AES-256-GCM</span> before storage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Encryption key is derived from your unique user ID using <span className="text-emerald-400">PBKDF2</span></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are stored only in your browser&apos;s localStorage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are <span className="text-emerald-400">never saved</span> to our database</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Keys are transmitted over <span className="text-emerald-400">HTTPS</span> only</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>You can delete your keys anytime</span>
                      </li>
                    </ul>
                    <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-800/50">
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
          <div className="mt-6 p-4 rounded-xl bg-slate-900/30 border border-slate-800/50">
            <h3 className="text-sm font-medium text-slate-300 mb-2">How it works</h3>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• Click the <FlaskConical className="h-3 w-3 inline" /> button to test if your API key is valid</li>
              <li>• Keys are sent with each request to use your own rate limits</li>
              <li>• If no custom key is set, the app uses default shared keys (with lower limits)</li>
              <li>• Keys are masked by default - click the eye icon or focus the field to reveal</li>
            </ul>
          </div>
        </MotionWrapper>
      </div>
    </div>
  );
}
