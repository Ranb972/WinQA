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
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MotionWrapper } from '@/components/ui/motion-wrapper';
import { getApiKeys, setApiKeys, maskApiKey, ApiKeys } from '@/lib/api-keys';
import { LLMProvider } from '@/lib/llm/types';

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
  const [saveMessage, setSaveMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [securityExpanded, setSecurityExpanded] = useState(false);

  // Test status per provider
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  // Track which fields are being edited (show full key vs masked)
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  // Load keys on mount
  useEffect(() => {
    async function loadKeys() {
      if (!isLoaded) return;

      setIsLoading(true);
      try {
        const stored = await getApiKeys(user?.id);
        setKeysState(stored);
        setSavedKeys(stored);
      } catch {
        // Error loading keys, start fresh
      } finally {
        setIsLoading(false);
      }
    }
    loadKeys();
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
      setSaveMessage('API keys saved and encrypted!');
      setTimeout(() => {
        setSaveMessage('');
      }, 2000);
    } catch {
      setSaveMessage('Failed to save keys');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(keys) !== JSON.stringify(savedKeys);
  const hasAnyKey = Object.values(savedKeys).some((k) => k && k.trim());

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
                  </motion.div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm">
                {saveMessage && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-emerald-400 flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {saveMessage}
                  </motion.span>
                )}
                {!saveMessage && hasAnyKey && (
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
