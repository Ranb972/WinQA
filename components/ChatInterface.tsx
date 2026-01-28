'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import ModelSelector from '@/components/ModelSelector';
import ChatMessage from '@/components/ChatMessage';
import BugReportModal from '@/components/BugReportModal';
import { LLMProvider, ChatMessage as ChatMessageType, ChatResponse, FallbackInfo, SpecificModel, defaultModels } from '@/lib/llm';
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
}

export default function ChatInterface({ initialPrompt }: ChatInterfaceProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'single' | 'multi'>('single');
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
              }),
            });

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
            });

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
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
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

        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-slate-400 hover:text-rose-400"
          disabled={messages.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="text-6xl mb-4">🧪</div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              Welcome to Chat Lab
            </h3>
            <p className="text-slate-400 max-w-md">
              Test prompts across different AI models. Select a model or enable
              comparison mode to see how different LLMs respond.
            </p>
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
                className="p-4 rounded-lg bg-slate-900/50 border border-slate-800"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-emerald-400">Assistant</span>
                  <span className="text-xs px-2 py-0.5 rounded border bg-purple-600/20 text-purple-400 border-purple-600/30">
                    {modelPreferences[selectedModel] || selectedModel}
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span className="text-sm">Thinking...</span>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          // Compare mode: side-by-side layout for assistant messages
          <div className="space-y-4 max-w-6xl mx-auto px-2">
            <AnimatePresence mode="popLayout">
              {(() => {
                // Group messages: user messages standalone, assistant messages grouped by timestamp
                const grouped: { type: 'user' | 'compare'; messages: Message[] }[] = [];
                let currentGroup: Message[] = [];
                let currentTimestamp: string | null = null;

                messages.forEach((message) => {
                  if (message.role === 'user') {
                    // Flush any pending compare group
                    if (currentGroup.length > 0) {
                      grouped.push({ type: 'compare', messages: currentGroup });
                      currentGroup = [];
                    }
                    grouped.push({ type: 'user', messages: [message] });
                    // Extract timestamp for the next group
                    currentTimestamp = message.id;
                  } else {
                    // Assistant message - add to current group
                    currentGroup.push(message);
                  }
                });

                // Flush remaining group
                if (currentGroup.length > 0) {
                  grouped.push({ type: 'compare', messages: currentGroup });
                }

                return grouped.map((group, groupIndex) => (
                  <motion.div
                    key={`group-${groupIndex}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    {group.type === 'user' ? (
                      // User message - full width
                      <div className="max-w-4xl mx-auto">
                        <ChatMessage
                          role={group.messages[0].role}
                          content={group.messages[0].content}
                          onFlagBug={() => handleFlagBug(group.messages[0])}
                          onSaveToLibrary={handleSaveToLibrary}
                        />
                      </div>
                    ) : (
                      // Compare group - side by side grid
                      <div className={`grid gap-3 ${
                        group.messages.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        group.messages.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                        'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'
                      }`}>
                        {group.messages.map((message) => (
                          <div key={message.id} className="min-w-0">
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
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ));
              })()}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your prompt here... (Shift+Enter for new line)"
            className="flex-1 min-h-[60px] max-h-[200px] bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
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
