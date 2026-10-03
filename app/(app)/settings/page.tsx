'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  fetchKeys,
  saveBuiltinKey,
  deleteBuiltinKey,
  testBuiltinKey,
  createCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  formatKeyDate,
  keyErrorText,
  KeysApiError,
  type BuiltinKeyInfo,
} from '@/lib/keys-client';
import { LLMProvider } from '@/lib/llm/types';
import { PROVIDER_MODELS, getDefaultModel } from '@/lib/llm/models';
import { specificModelDisplayNames, defaultModels } from '@/lib/llm/registry';
import { getModelPreferences, setModelPreference, ModelPreferences } from '@/lib/model-preferences';
import {
  CustomProviderView,
  CustomProviderSubmit,
  toCustomProviderView,
  buildProviderPatch,
  customProviderErrorText,
  MAX_CUSTOM_PROVIDERS,
  testCustomProviderConnection,
  CustomProviderTestResult,
} from '@/lib/custom-providers';
import CustomProviderCard from '@/components/CustomProviderCard';
import KeyMigrationBanner from '@/components/KeyMigrationBanner';
import { subscribeKeysChanged } from '@/lib/key-migration';
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
    description: `Access ${specificModelDisplayNames[defaultModels.cohere]} and other Cohere models`,
    placeholder: 'Enter your Cohere API key',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
  },
  {
    key: 'gemini',
    name: 'Google Gemini',
    description: `Access ${specificModelDisplayNames[defaultModels.gemini]} and other Google models`,
    placeholder: 'Enter your Google AI API key',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    key: 'groq',
    name: 'Groq',
    description: `Access ${specificModelDisplayNames[defaultModels.groq]} and other fast models`,
    placeholder: 'Enter your Groq API key',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    key: 'mistral',
    name: 'Mistral',
    description: `Access ${specificModelDisplayNames[defaultModels.mistral]} and other Mistral models`,
    placeholder: 'Enter your Mistral API key',
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
];

type TestStatus = 'idle' | 'testing' | 'valid' | 'invalid';

type RowFlag = Partial<Record<LLMProvider, boolean>>;

// How long the first click on Remove stays armed.
const CONFIRM_REMOVE_MS = 3000;

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  // Saved built-in keys as the server describes them (last four characters and
  // dates). The browser never holds a saved key.
  const [saved, setSaved] = useState<Partial<Record<LLMProvider, BuiltinKeyInfo>>>({});
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  // Keys the user is typing. Component state only: never written to browser storage.
  const [typed, setTyped] = useState<Partial<Record<LLMProvider, string>>>({});
  // A saved row whose input is open to replace the key.
  const [replacing, setReplacing] = useState<RowFlag>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Partial<Record<LLMProvider, 'save' | 'remove'>>>({});
  const [confirmRemove, setConfirmRemove] = useState<RowFlag>({});
  const [isLoading, setIsLoading] = useState(true);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const { toast } = useToast();

  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});
  // Bumped by every test and every edit of a row, so an older answer is dropped.
  const testSeq = useRef<Record<string, number>>({});
  const [modelPreferences, setModelPreferencesState] = useState<ModelPreferences>({});
  const [customProviders, setCustomProviders] = useState<CustomProviderView[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProviderView | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<Record<string, unknown> | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);

  // Reads the saved keys and custom providers from the account. A failure is
  // shown in place of the rows, because "no key saved" would be a guess.
  const refreshKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const overview = await fetchKeys();
      const next: Partial<Record<LLMProvider, BuiltinKeyInfo>> = {};
      for (const info of overview.builtin) next[info.provider] = info;
      setSaved(next);
      setCustomProviders(overview.custom.map(toCustomProviderView));
      setKeysError(null);
    } catch (error) {
      setKeysError(keyErrorText(error));
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!isLoaded) return;

      setIsLoading(true);
      try {
        const prefs = getModelPreferences();
        setModelPreferencesState(prefs);
      } catch {
        // Error loading data, start fresh
      }
      await refreshKeys();
      setIsLoading(false);
    }
    loadData();
  }, [isLoaded, user?.id, refreshKeys]);

  // The browser copy of the keys was moved or deleted (this tab or another):
  // read the account again.
  useEffect(() => subscribeKeysChanged(() => void refreshKeys()), [refreshKeys]);

  const toggleVisibility = (provider: string) => {
    setVisibility((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  // A row was edited or acted on: drop its test status and error, and any test still in flight.
  const resetRowFeedback = (provider: LLMProvider) => {
    testSeq.current[provider] = (testSeq.current[provider] ?? 0) + 1;
    setTestStatus((prev) => ({ ...prev, [provider]: 'idle' }));
    setTestErrors((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
  };

  const setRowError = (provider: LLMProvider, message: string) => {
    setTestErrors((prev) => ({ ...prev, [provider]: message }));
  };

  const handleKeyChange = (provider: LLMProvider, value: string) => {
    setTyped((prev) => ({ ...prev, [provider]: value }));
    resetRowFeedback(provider);
  };

  const handleClearTyped = (provider: LLMProvider) => {
    setTyped((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
    resetRowFeedback(provider);
  };

  const handleReplace = (provider: LLMProvider) => {
    resetRowFeedback(provider);
    setReplacing((prev) => ({ ...prev, [provider]: true }));
  };

  const handleCancelReplace = (provider: LLMProvider) => {
    handleClearTyped(provider);
    setReplacing((prev) => ({ ...prev, [provider]: false }));
    setVisibility((prev) => ({ ...prev, [provider]: false }));
  };

  // Tests the key being typed, or, with nothing typed, the key saved on the account.
  const handleTestKey = async (provider: LLMProvider) => {
    const typedKey = (typed[provider] ?? '').trim();
    const testingTyped = typedKey !== '';
    if (!testingTyped && !saved[provider]) return;

    resetRowFeedback(provider);
    const seq = testSeq.current[provider];
    setTestStatus((prev) => ({ ...prev, [provider]: 'testing' }));

    try {
      const result = await testBuiltinKey(provider, testingTyped ? typedKey : undefined);
      if (seq !== testSeq.current[provider]) return;

      // Only a 200 means the route ran the test and recorded the outcome on the saved
      // record; a 401, 404 or 500 recorded nothing. Show it without waiting for a reload.
      if (!testingTyped && result.status === 200) {
        setSaved((prev) => {
          const current = prev[provider];
          return current
            ? { ...prev, [provider]: { ...current, lastTestedAt: new Date().toISOString(), lastTestOk: result.valid } }
            : prev;
        });
      }

      if (result.valid) {
        setTestStatus((prev) => ({ ...prev, [provider]: 'valid' }));
      } else {
        setTestStatus((prev) => ({ ...prev, [provider]: 'invalid' }));
        setRowError(provider, keyErrorText(new KeysApiError(result.error || 'Invalid key', result.status)));
        // The saved key is gone (removed elsewhere): show the list as it is now.
        if (!testingTyped && result.status === 404) void refreshKeys();
      }
    } catch {
      if (seq !== testSeq.current[provider]) return;
      setTestStatus((prev) => ({ ...prev, [provider]: 'invalid' }));
      setRowError(provider, 'Failed to test key');
    }
  };

  const handleSaveKey = async (provider: LLMProvider, name: string) => {
    const apiKey = (typed[provider] ?? '').trim();
    if (!apiKey || busy[provider]) return;

    resetRowFeedback(provider);
    setBusy((prev) => ({ ...prev, [provider]: 'save' }));
    try {
      const info = await saveBuiltinKey(provider, apiKey);
      setSaved((prev) => ({ ...prev, [provider]: info }));
      // The typed key has done its job: it is not kept anywhere in the browser.
      setTyped((prev) => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
      setReplacing((prev) => ({ ...prev, [provider]: false }));
      setVisibility((prev) => ({ ...prev, [provider]: false }));
      toast({
        title: 'Key saved',
        description: `Your ${name} key is saved to your account.`,
        variant: 'success',
      });
    } catch (error) {
      setRowError(provider, keyErrorText(error));
    } finally {
      setBusy((prev) => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
    }
  };

  // The first click arms the button for CONFIRM_REMOVE_MS; the second removes the key.
  const handleRemoveKey = async (provider: LLMProvider, name: string) => {
    if (busy[provider]) return;
    if (!confirmRemove[provider]) {
      setConfirmRemove((prev) => ({ ...prev, [provider]: true }));
      setTimeout(() => setConfirmRemove((prev) => ({ ...prev, [provider]: false })), CONFIRM_REMOVE_MS);
      return;
    }

    setConfirmRemove((prev) => ({ ...prev, [provider]: false }));
    resetRowFeedback(provider);
    setBusy((prev) => ({ ...prev, [provider]: 'remove' }));
    try {
      await deleteBuiltinKey(provider);
      setSaved((prev) => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
      toast({
        title: 'Key removed',
        description: `Your ${name} key is removed. WinQA's shared key is used again.`,
        variant: 'success',
      });
    } catch (error) {
      setRowError(provider, keyErrorText(error));
    } finally {
      setBusy((prev) => {
        const updated = { ...prev };
        delete updated[provider];
        return updated;
      });
    }
  };

  const handleModelChange = (provider: LLMProvider, modelId: string) => {
    setModelPreference(provider, modelId);
    setModelPreferencesState((prev) => ({ ...prev, [provider]: modelId }));
  };

  // A 404 from the provider routes means it is gone (deleted in another tab):
  // show the list as it is now.
  const refreshIfGone = (error: unknown) => {
    if (error instanceof KeysApiError && error.status === 404) void refreshKeys();
  };

  // Creates or edits one provider and writes only that provider. Resolves to null
  // when it was saved, otherwise to the text the dialog shows (it stays open).
  const handleSaveProvider = async (data: CustomProviderSubmit): Promise<string | null> => {
    try {
      if (data.id) {
        const current = customProviders.find((p) => p.id === data.id);
        if (!current) {
          void refreshKeys();
          return 'This provider no longer exists. The list has been refreshed.';
        }
        const patch = buildProviderPatch(current, data);
        if (Object.keys(patch).length === 0) return null;
        const updated = toCustomProviderView(await updateCustomProvider(data.id, patch));
        setCustomProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        toast({
          title: 'Provider updated',
          description: `${updated.name} has been updated`,
          variant: 'success',
        });
      } else {
        const created = toCustomProviderView(
          await createCustomProvider({
            name: data.name,
            baseUrl: data.baseUrl,
            modelId: data.modelId,
            headerType: data.headerType,
            enabled: data.enabled,
            apiKey: data.apiKey,
          })
        );
        setCustomProviders((prev) => [...prev, created]);
        toast({
          title: 'Provider added',
          description: `${created.name} has been added`,
          variant: 'success',
        });
      }
      return null;
    } catch (error) {
      refreshIfGone(error);
      return error instanceof KeysApiError && error.status === 404
        ? 'This provider no longer exists. The list has been refreshed.'
        : customProviderErrorText(error);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await deleteCustomProvider(id);
      setCustomProviders((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      refreshIfGone(error);
      toast({
        title: 'Could not remove provider',
        description: customProviderErrorText(error),
        variant: 'destructive',
      });
    }
  };

  // Sets (never flips) the enabled state, so a repeated call cannot invert it.
  // State changes only after the write, so the switch never shows an unsaved state.
  // Only `enabled` is written, so a toggle cannot undo an edit saved meanwhile.
  const handleSetProviderEnabled = async (id: string, next: boolean) => {
    try {
      const updated = toCustomProviderView(await updateCustomProvider(id, { enabled: next }));
      setCustomProviders((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (error) {
      refreshIfGone(error);
      toast({
        title: 'Could not update provider',
        description: customProviderErrorText(error),
        variant: 'destructive',
      });
      throw error;
    }
  };

  // The card calls this before turning a provider on and only persists the new
  // state (handleSetProviderEnabled with true) after a pass. The server tests the
  // saved key against the saved base URL; no key leaves the account.
  const handleTestCustomProvider = async (
    provider: CustomProviderView
  ): Promise<CustomProviderTestResult> => {
    const result = await testCustomProviderConnection({ providerId: provider.id });
    // The route's own "Custom provider not found": the provider is gone.
    if (!result.valid && result.status === 404 && result.error === 'Custom provider not found') {
      void refreshKeys();
    }
    return result;
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

  const calibratedCount = Object.keys(saved).length;

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

        <KeyMigrationBanner className="mb-8" />

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
                  Keys you save are stored in our database encrypted with AES-256-GCM under a key held only in our server environment. They are decrypted only on our servers, at the moment a request goes to that provider. They are never sent back to your browser; Settings shows only the last four characters. Removing a key, or deleting your account, deletes it. If a built-in provider rejects your key as unauthorized, WinQA may retry the request once with its shared key; custom providers are not retried.
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
            <div className="px-5 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white">Authentication Credentials</h2>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{calibratedCount}/{providers.length} Calibrated</span>
            </div>

            {/* Credential Rows */}
            {keysError ? (
              <div className="p-5" role="alert">
                <p className="text-sm text-red-400 font-mono break-words">
                  Could not load your saved keys. {keysError}
                </p>
                <button
                  type="button"
                  onClick={() => void refreshKeys()}
                  disabled={keysLoading}
                  className="mt-3 inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded border border-white/[0.1] text-zinc-300 hover:text-white hover:border-orange-500/40 text-xs font-mono uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                >
                  {keysLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Retry
                </button>
              </div>
            ) : (
            <div>
              {providers.map((provider, index) => {
                const info = saved[provider.key];
                const isSaved = !!info;
                const isReplacing = !!replacing[provider.key];
                const showInput = !isSaved || isReplacing;
                const typedValue = typed[provider.key] || '';
                const isVisible = visibility[provider.key];
                const status = testStatus[provider.key] || 'idle';
                const error = testErrors[provider.key];
                const rowBusy = busy[provider.key];
                const inputId = `key-${provider.key}`;
                const updated = formatKeyDate(info?.updatedAt);
                const tested = formatKeyDate(info?.lastTestedAt);
                const rejected = formatKeyDate(info?.lastRejectedAt);

                return (
                  <motion.div
                    key={provider.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index, duration: 0.3 }}
                    className="p-5 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                          <Settings className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">
                              {provider.name}
                            </span>
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
                        className="inline-flex items-center gap-1 min-h-11 whitespace-nowrap px-1 pl-11 sm:pl-1 text-orange-500 text-xs font-mono uppercase tracking-[0.15em] hover:text-orange-400 transition-colors"
                      >
                        Acquire Key
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="mt-3">
                      {isSaved && (
                        <div className={isReplacing ? 'mb-3' : ''}>
                          <p className="text-sm text-white font-mono break-words">
                            {info.last4 ? `Saved key ending in ${info.last4}` : 'Saved key'}
                            {updated && <span className="text-zinc-500">{` · updated ${updated}`}</span>}
                          </p>
                          {(tested || rejected) && (
                            <p className="text-xs font-mono mt-1 break-words">
                              {tested && (
                                <span className={info.lastTestOk === false ? 'text-red-400' : 'text-emerald-400'}>
                                  {info.lastTestOk === false ? `Test failed ${tested}` : `Tested OK ${tested}`}
                                </span>
                              )}
                              {tested && rejected && <span className="text-zinc-600">{' · '}</span>}
                              {rejected && <span className="text-amber-400">{`Rejected on ${rejected}, check it`}</span>}
                            </p>
                          )}
                        </div>
                      )}

                      {!isSaved && (
                        <p className="text-xs text-zinc-500 mb-3">Using WinQA&apos;s shared key (daily limit)</p>
                      )}

                      {showInput && (
                        <>
                          <label
                            htmlFor={inputId}
                            className="block text-[10px] font-mono uppercase tracking-[0.15em] text-white/40 mb-1.5"
                          >
                            {isReplacing ? 'New Authentication Key' : 'Authentication Key'}
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={inputId}
                                type={isVisible ? 'text' : 'password'}
                                value={typedValue}
                                onChange={(e) => handleKeyChange(provider.key, e.target.value)}
                                placeholder={provider.placeholder}
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                className="pr-12 h-11 bg-black border-white/[0.08] text-white font-mono text-sm placeholder:text-white/20 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                              />
                              <button
                                type="button"
                                onClick={() => toggleVisibility(provider.key)}
                                aria-label={`Show ${provider.name} key`}
                                aria-pressed={!!isVisible}
                                title={isVisible ? 'Hide key' : 'Show key'}
                                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                              >
                                {isVisible ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>

                            {typedValue && (
                              <button
                                type="button"
                                onClick={() => handleTestKey(provider.key)}
                                aria-label={`Test ${provider.name} key`}
                                disabled={status === 'testing'}
                                className={`h-11 w-11 shrink-0 rounded flex items-center justify-center transition-colors ${
                                  status === 'valid'
                                    ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                                    : status === 'invalid'
                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                    : 'text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10'
                                }`}
                                title="Test API key"
                              >
                                {status === 'testing' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                            )}

                            {typedValue && (
                              <button
                                type="button"
                                onClick={() => handleClearTyped(provider.key)}
                                aria-label={`Clear ${provider.name} key`}
                                className="h-11 w-11 shrink-0 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Clear the typed key"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveKey(provider.key, provider.name)}
                              aria-label={`Save ${provider.name} key`}
                              disabled={!typedValue.trim() || !!rowBusy}
                              className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded bg-orange-500 hover:bg-orange-400 text-black text-xs font-mono uppercase tracking-[0.12em] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {rowBusy === 'save' ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Save className="h-4 w-4" aria-hidden="true" />
                              )}
                              Save
                            </button>
                            {isReplacing && (
                              <button
                                type="button"
                                onClick={() => handleCancelReplace(provider.key)}
                                aria-label={`Cancel replacing ${provider.name} key`}
                                disabled={!!rowBusy}
                                className="inline-flex items-center justify-center min-h-11 px-4 rounded border border-white/[0.1] text-zinc-400 hover:text-white text-xs font-mono uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {isSaved && !isReplacing && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleReplace(provider.key)}
                            aria-label={`Replace ${provider.name} key`}
                            disabled={!!rowBusy}
                            className="inline-flex items-center justify-center min-h-11 px-4 rounded border border-white/[0.1] text-zinc-300 hover:text-white hover:border-orange-500/40 text-xs font-mono uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTestKey(provider.key)}
                            aria-label={`Test ${provider.name} key`}
                            disabled={status === 'testing' || !!rowBusy}
                            className={`inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded border text-xs font-mono uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                              status === 'valid'
                                ? 'border-emerald-500/40 text-emerald-400'
                                : status === 'invalid'
                                ? 'border-red-500/40 text-red-400'
                                : 'border-white/[0.1] text-zinc-300 hover:text-white hover:border-orange-500/40'
                            }`}
                          >
                            {status === 'testing' ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <FlaskConical className="h-4 w-4" aria-hidden="true" />
                            )}
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveKey(provider.key, provider.name)}
                            aria-label={
                              confirmRemove[provider.key]
                                ? `Click again to remove ${provider.name} key`
                                : `Remove ${provider.name} key`
                            }
                            disabled={!!rowBusy}
                            className={`inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded border text-xs font-mono uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                              confirmRemove[provider.key]
                                ? 'border-red-500/50 bg-red-500/15 text-red-300'
                                : 'border-white/[0.1] text-zinc-400 hover:text-red-400 hover:border-red-500/40'
                            }`}
                          >
                            {rowBusy === 'remove' ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                            {confirmRemove[provider.key] ? 'Confirm' : 'Remove'}
                          </button>
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          role="alert"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-red-400 mt-2 font-mono break-words"
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
                          <SelectTrigger className="bg-black border-white/[0.08] h-11 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20">
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
            )}
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

            <div className="px-5 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-white">Connected Sources</h2>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{keysError ? '–' : customProviders.length}/{MAX_CUSTOM_PROVIDERS} Active</span>
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
                        onToggle={(next) => handleSetProviderEnabled(provider.id, next)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {customProviders.length === 0 && (
                <p
                  role={keysError ? 'alert' : undefined}
                  className={`font-mono text-xs uppercase tracking-[0.15em] leading-relaxed text-center px-2 py-4 mb-4 break-words ${
                    keysError ? 'text-red-400' : 'text-zinc-400'
                  }`}
                >
                  {keysError ? 'Could not load your providers' : 'No intelligence sources connected'}
                </p>
              )}

              {/* Not offered while the list failed to load: a new provider could sit next to ones this page has not seen. */}
              {!keysError && customProviders.length < MAX_CUSTOM_PROVIDERS && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded border border-dashed border-white/[0.08] text-zinc-400 hover:text-white hover:border-orange-500/30 font-mono text-xs uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add provider
                </button>
              )}

              {customProviders.length >= MAX_CUSTOM_PROVIDERS && (
                <p className="font-mono text-xs uppercase tracking-[0.15em] leading-relaxed text-zinc-400 text-center px-2 break-words">
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
                        <span>Keys you save are stored in our database encrypted with AES-256-GCM under a key held only in our server environment.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>They are decrypted only on our servers, at the moment a request goes to that provider.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>They are never sent back to your browser; Settings shows only the last four characters.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Removing a key, or deleting your account, deletes it.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>If a built-in provider rejects your key as unauthorized, WinQA may retry the request once with its shared key; custom providers are not retried.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Keys saved in this browser before October 2026 stay there, obfuscated, and are sent to our server over HTTPS with each request that needs them until you move them from Settings; browser storage ends on October 31, 2026.</span>
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
                      Your keys are protected by our server-side encryption and your account&apos;s sign-in. Deleting your account removes them.
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
              <li>A key you save is used on our server for your requests, so you get your own rate limits</li>
              <li>If no custom key is set, the app uses default shared keys (with lower limits)</li>
              <li>A saved key shows only its last four characters; use the eye icon to check a key while you type it</li>
            </ul>
          </div>
        </MotionWrapper>
      </div>
    </div>
  );
}
