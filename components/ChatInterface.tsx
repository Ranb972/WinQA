'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Trash2, Bot, User } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import ModelSelector from '@/components/ModelSelector';
import ChatMessage from '@/components/ChatMessage';
import BugReportModal from '@/components/BugReportModal';
import { LLMProvider, ChatMessage as ChatMessageType, ChatResponse, FallbackInfo, SpecificModel, defaultModels, modelDisplayNames } from '@/lib/llm';
import { cn } from '@/lib/utils';
import { getApiKeys, ApiKeys } from '@/lib/api-keys';
import { getModelPreferences, setModelPreference } from '@/lib/model-preferences';
import { CustomProvider, getEnabledCustomProviders } from '@/lib/custom-providers';

interface Message extends ChatMessageType {
  id: string;
  model?: LLMProvider;
  specificModel?: string;
  responseTime?: number;
  fallback?: FallbackInfo;
  isLoading?: boolean;
}

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = 45000
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 45s');
    }
    throw error;
  }
};

const DEFAULT_MODEL_PREFERENCES: Record<LLMProvider, SpecificModel> = defaultModels;

interface ChatInterfaceProps {
  initialPrompt?: string;
  initialCompareMode?: boolean;
}

export default function ChatInterface({ initialPrompt, initialCompareMode = false }: ChatInterfaceProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'single' | 'multi'>(initialCompareMode ? 'multi' : 'single');
  const [selectedModel, setSelectedModel] = useState<LLMProvider>('cohere');
  const [selectedModels, setSelectedModels] = useState<LLMProvider[]>(['cohere', 'gemini']);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [bugData, setBugData] = useState<{
    promptContext: string;
    modelResponse: string;
    modelUsed: LLMProvider;
  } | null>(null);
  const [modelPreferences, setModelPreferences] = useState<Record<LLMProvider, SpecificModel>>(DEFAULT_MODEL_PREFERENCES);
  const [cachedApiKeys, setCachedApiKeys] = useState<ApiKeys>({});
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [selectedCustomProviders, setSelectedCustomProviders] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load API keys and custom providers on mount and when user changes
  useEffect(() => {
    async function loadData() {
      const keys = await getApiKeys(user?.id);
      setCachedApiKeys(keys);

      // Load enabled custom providers
      const providers = await getEnabledCustomProviders(user?.id);
      setCustomProviders(providers);
    }
    loadData();
  }, [user?.id]);

  // Load model preferences from localStorage
  useEffect(() => {
    // Load from new storage module
    const prefs = getModelPreferences();
    if (Object.keys(prefs).length > 0) {
      setModelPreferences((prev) => ({ ...prev, ...prefs } as Record<LLMProvider, SpecificModel>));
    }
    // Also check legacy storage
    const legacy = localStorage.getItem('modelPreferences');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        setModelPreferences((prev) => ({ ...prev, ...parsed }));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Handle model preference change - save to new storage
  const handleModelPreferenceChange = (provider: LLMProvider, model: SpecificModel) => {
    setModelPreferences((prev) => ({ ...prev, [provider]: model }));
    setModelPreference(provider, model);
  };

  // Sync mode with initialCompareMode prop when it changes (for URL navigation)
  useEffect(() => {
    setMode(initialCompareMode ? 'multi' : 'single');
  }, [initialCompareMode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const timestamp = Date.now();
    const userMessage: Message = {
      id: timestamp.toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const chatHistory = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Use cached API keys (already decrypted)
      const customApiKeys = cachedApiKeys;

      if (mode === 'single') {
        // Single model: one request with loading indicator
        const response = await fetchWithTimeout('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatHistory, models: selectedModel, modelPreferences, customApiKeys }),
        });

        const data = await response.json() as ChatResponse;
        const assistantMessage: Message = {
          id: (timestamp + 1).toString(),
          role: 'assistant',
          content: data.error || data.content,
          model: data.model,
          specificModel: data.specificModel,
          responseTime: data.responseTime,
          fallback: data.fallback,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Compare Mode: Progressive loading with parallel requests
        // Get selected custom providers
        const activeCustomProviders = customProviders.filter((p) =>
          selectedCustomProviders.includes(p.id)
        );

        // Create placeholder messages for each built-in model
        const builtInPlaceholders: Message[] = selectedModels.map((model) => ({
          id: `${timestamp}-${model}`,
          role: 'assistant' as const,
          content: '',
          model,
          isLoading: true,
        }));

        // Create placeholder messages for each custom provider
        const customPlaceholders: Message[] = activeCustomProviders.map((provider) => ({
          id: `${timestamp}-custom:${provider.id}`,
          role: 'assistant' as const,
          content: '',
          model: `custom:${provider.id}` as LLMProvider,
          specificModel: `${provider.name}: ${provider.modelId}`,
          isLoading: true,
        }));

        setMessages((prev) => [...prev, ...builtInPlaceholders, ...customPlaceholders]);

        // Fire off parallel requests for built-in providers
        const builtInPromises = selectedModels.map(async (model) => {
          const messageId = `${timestamp}-${model}`;
          try {
            const response = await fetchWithTimeout('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: chatHistory,
                models: model,
                modelPreferences,
                customApiKeys,
                crossProviderFallback: false,
                maxFallbackAttempts: 2,
                fallbackDelay: 200,
              }),
            }, 30000);

            const data = await response.json() as ChatResponse;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: data.error || data.content,
                      specificModel: data.specificModel,
                      responseTime: data.responseTime,
                      fallback: data.fallback,
                      isLoading: false,
                    }
                  : msg
              )
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Request failed';
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: `Error: ${errorMessage}`,
                      isLoading: false,
                    }
                  : msg
              )
            );
          }
        });

        // Fire off parallel requests for custom providers
        const customPromises = activeCustomProviders.map(async (provider) => {
          const messageId = `${timestamp}-custom:${provider.id}`;
          try {
            const response = await fetchWithTimeout('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: chatHistory,
                models: `custom:${provider.id}`,
                customProvider: provider,
              }),
            }, 30000);

            const data = await response.json() as ChatResponse;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: data.error || data.content,
                      specificModel: data.specificModel || `${provider.name}: ${provider.modelId}`,
                      responseTime: data.responseTime,
                      isLoading: false,
                    }
                  : msg
              )
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Request failed';
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: `Error: ${errorMessage}`,
                      isLoading: false,
                    }
                  : msg
              )
            );
          }
        });

        // Wait for all to complete (but UI updates progressively)
        await Promise.allSettled([...builtInPromises, ...customPromises]);
      }
    } catch {
      const errorMessage: Message = {
        id: (timestamp + 1).toString(),
        role: 'assistant',
        content: 'An error occurred while processing your request.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFlagBug = (message: Message) => {
    // Find the user message that preceded this assistant message
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    const userMessage = messages.slice(0, messageIndex).reverse().find((m) => m.role === 'user');

    setBugData({
      promptContext: userMessage?.content || '',
      modelResponse: message.content,
      modelUsed: message.model || 'cohere',
    });
    setBugModalOpen(true);
  };

  const handleSaveToLibrary = () => {
    // TODO: Implement save to library dialog
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.06]">
        <div className="overflow-x-auto">
          <ModelSelector
            mode={mode}
            selectedModel={selectedModel}
            selectedModels={selectedModels}
            modelPreferences={modelPreferences}
            customProviders={customProviders}
            selectedCustomProviders={selectedCustomProviders}
            onModelChange={setSelectedModel}
            onModelsChange={setSelectedModels}
            onModeChange={setMode}
            onModelPreferenceChange={handleModelPreferenceChange}
            onCustomProvidersChange={setSelectedCustomProviders}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-white/50 hover:text-white shrink-0 self-end sm:self-auto gap-2"
          disabled={messages.length === 0}
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 wq-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center justify-center h-full py-24"
          >
            <div className="text-center max-w-md px-4 sm:px-6">
              {mode === 'single' ? (
                <>
                  <div className="relative inline-block mb-8">
                    <div className="bg-orange-500/10 rounded-2xl p-5">
                      <Bot className="w-10 h-10 text-orange-500" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <h2 className="font-heading text-2xl font-bold text-white mb-3">
                    Interrogation Ready
                  </h2>
                  <p className="text-white/50 text-sm leading-relaxed mb-8">
                    The suspect is awaiting your questions. Select your target model and begin the interrogation. All responses will be logged for analysis.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span>Session active</span>
                    <span className="mx-2 text-white/20">|</span>
                    <span className="font-mono">{modelDisplayNames[selectedModel] || selectedModel}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                    {selectedModels.map((m) => (
                      <span key={m} className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 font-mono">
                        {modelDisplayNames[m] || m}
                      </span>
                    ))}
                  </div>
                  <h2 className="font-heading text-2xl font-bold text-white mb-3">
                    Comparative Interrogation
                  </h2>
                  <p className="text-white/40 text-sm leading-relaxed mb-8">
                    Select up to 4 AI suspects and question them simultaneously. Compare their responses side-by-side to identify inconsistencies and evaluate performance.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span>{selectedModels.length} suspects selected</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : mode === 'single' ? (
          // Single mode: vertical stack
          <div className="space-y-4 max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <ChatMessage
                    role={message.role}
                    content={message.content}
                    model={message.model}
                    specificModel={message.specificModel}
                    responseTime={message.responseTime}
                    fallback={message.fallback}
                    isLoading={message.isLoading}
                    onFlagBug={() => handleFlagBug(message)}
                    onSaveToLibrary={handleSaveToLibrary}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex gap-4 py-4 border-t border-white/[0.04]"
              >
                <div className="shrink-0 w-8 h-8 rounded bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1">
                  <span className="font-mono text-xs font-medium text-orange-500 mb-2 block uppercase tracking-wider">
                    {modelPreferences[selectedModel] || selectedModel}
                  </span>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-orange-500/60 rounded-full animate-pulse" />
                    <span className="w-2 h-2 bg-orange-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <span className="w-2 h-2 bg-orange-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          // Compare mode: group messages into rounds, render assistants in a grid
          <div className="space-y-4 max-w-7xl mx-auto">
            <AnimatePresence mode="popLayout">
              {(() => {
                // Group messages into rounds: user message + its assistant responses
                const groups: { user?: Message; assistants: Message[] }[] = [];
                let current: { user?: Message; assistants: Message[] } = { assistants: [] };
                for (const msg of messages) {
                  if (msg.role === 'user') {
                    if (current.user || current.assistants.length > 0) groups.push(current);
                    current = { user: msg, assistants: [] };
                  } else {
                    current.assistants.push(msg);
                  }
                }
                if (current.user || current.assistants.length > 0) groups.push(current);

                return groups.map((group, gi) => (
                  <div key={gi} className="space-y-4">
                    {/* User message — full width */}
                    {group.user && (
                      <motion.div
                        key={group.user.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                        <ChatMessage
                          role={group.user.role}
                          content={group.user.content}
                        />
                      </motion.div>
                    )}
                    {/* Assistant responses — responsive grid */}
                    {group.assistants.length > 0 && (
                      <div className={cn(
                        'grid grid-cols-1 gap-4',
                        group.assistants.length === 2 && 'md:grid-cols-2',
                        group.assistants.length === 3 && 'md:grid-cols-3',
                        group.assistants.length >= 4 && 'md:grid-cols-2',
                      )}>
                        {group.assistants.map((message) => (
                          <motion.div
                            key={message.id}
                            className="h-full"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          >
                            <ChatMessage
                              role={message.role}
                              content={message.content}
                              model={message.model}
                              specificModel={message.specificModel}
                              responseTime={message.responseTime}
                              fallback={message.fallback}
                              isLoading={message.isLoading}
                              onFlagBug={() => handleFlagBug(message)}
                              onSaveToLibrary={handleSaveToLibrary}
                              compact
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="mt-2 border-t border-white/[0.04] px-6 py-4">
        <div className="flex gap-3 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Begin interrogation... (Enter to send, Shift+Enter for new line)"
            className="flex-1 min-h-[48px] max-h-[200px] bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/40 resize-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 px-4 py-3"
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-lg bg-orange-500/80 hover:bg-orange-500 text-black flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 font-mono tracking-wider uppercase">
          <span>Session #...</span>
          <span>{messages.filter(m => m.role === 'user').length} exchanges logged</span>
        </div>
      </div>

      {/* Bug Report Modal */}
      {bugData && (
        <BugReportModal
          open={bugModalOpen}
          onOpenChange={setBugModalOpen}
          promptContext={bugData.promptContext}
          modelResponse={bugData.modelResponse}
          modelUsed={bugData.modelUsed}
        />
      )}
    </div>
  );
}
