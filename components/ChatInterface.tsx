'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import ModelSelector from '@/components/ModelSelector';
import ChatMessage from '@/components/ChatMessage';
import BugReportModal from '@/components/BugReportModal';
import { LLMProvider, ChatMessage as ChatMessageType, ChatResponse, FallbackInfo, SpecificModel, defaultModels } from '@/lib/llm';

interface Message extends ChatMessageType {
  id: string;
  model?: LLMProvider;
  specificModel?: string;
  responseTime?: number;
  fallback?: FallbackInfo;
}

const DEFAULT_MODEL_PREFERENCES: Record<LLMProvider, SpecificModel> = defaultModels;

interface ChatInterfaceProps {
  initialPrompt?: string;
}

export default function ChatInterface({ initialPrompt }: ChatInterfaceProps) {
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load model preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('modelPreferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setModelPreferences({ ...DEFAULT_MODEL_PREFERENCES, ...parsed });
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Save model preferences to localStorage
  useEffect(() => {
    localStorage.setItem('modelPreferences', JSON.stringify(modelPreferences));
  }, [modelPreferences]);

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

    const userMessage: Message = {
      id: Date.now().toString(),
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
      const models = mode === 'single' ? selectedModel : selectedModels;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, models, modelPreferences }),
      });

      const data = await response.json();

      if (mode === 'single') {
        const chatResponse = data as ChatResponse;
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: chatResponse.error || chatResponse.content,
          model: chatResponse.model,
          specificModel: chatResponse.specificModel,
          responseTime: chatResponse.responseTime,
          fallback: chatResponse.fallback,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const multiResponse = data as { responses: ChatResponse[] };
        const assistantMessages: Message[] = multiResponse.responses.map((r, i) => ({
          id: (Date.now() + i + 1).toString(),
          role: 'assistant' as const,
          content: r.error || r.content,
          model: r.model,
          specificModel: r.specificModel,
          responseTime: r.responseTime,
          fallback: r.fallback,
        }));
        setMessages((prev) => [...prev, ...assistantMessages]);
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
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
    // This would open a dialog to save the prompt pair to the library
    // For now, we'll just log it
    console.log('Save to library');
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
          onModelChange={setSelectedModel}
          onModelsChange={setSelectedModels}
          onModeChange={setMode}
          onModelPreferenceChange={(provider, model) =>
            setModelPreferences(prev => ({ ...prev, [provider]: model }))
          }
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🧪</div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              Welcome to Chat Lab
            </h3>
            <p className="text-slate-400 max-w-md">
              Test prompts across different AI models. Select a model or enable
              comparison mode to see how different LLMs respond.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                model={message.model}
                specificModel={message.specificModel}
                responseTime={message.responseTime}
                fallback={message.fallback}
                onFlagBug={() => handleFlagBug(message)}
                onSaveToLibrary={handleSaveToLibrary}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating response...</span>
              </div>
            )}
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
