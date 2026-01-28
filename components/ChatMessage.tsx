'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bug, Library, Copy, Check, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LLMProvider, FallbackInfo, providerDisplayNames, specificModelDisplayNames } from '@/lib/llm';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: LLMProvider;
  specificModel?: string;
  responseTime?: number;
  fallback?: FallbackInfo;
  isLoading?: boolean;
  onFlagBug?: () => void;
  onSaveToLibrary?: () => void;
  compact?: boolean;
}

export default function ChatMessage({
  role,
  content,
  model,
  specificModel,
  responseTime,
  fallback,
  isLoading,
  onFlagBug,
  onSaveToLibrary,
  compact,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied to clipboard',
      description: 'Response copied',
    });
  };

  const isAssistant = role === 'assistant';

  // Loading state for this message
  if (isLoading) {
    return (
      <div className="animate-fade-in p-4 rounded-lg bg-slate-900/50 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-emerald-400">Assistant</span>
          {model && (
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded border',
                model === 'cohere' && 'bg-purple-600/20 text-purple-400 border-purple-600/30',
                model === 'gemini' && 'bg-blue-600/20 text-blue-400 border-blue-600/30',
                model === 'groq' && 'bg-orange-600/20 text-orange-400 border-orange-600/30',
                model === 'openrouter' && 'bg-green-600/20 text-green-400 border-green-600/30'
              )}
            >
              {providerDisplayNames[model]}
            </span>
          )}
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
      </div>
    );
  }

  return (
    <div
      className={cn(
        'animate-fade-in rounded-lg h-full',
        compact ? 'p-3' : 'p-4',
        isAssistant ? 'bg-slate-900/50 border border-slate-800' : 'bg-slate-800/30'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium',
              isAssistant ? 'text-emerald-400' : 'text-slate-300'
            )}
          >
            {isAssistant ? 'Assistant' : 'You'}
          </span>
          {model && (
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded border',
                model === 'cohere' && 'bg-purple-600/20 text-purple-400 border-purple-600/30',
                model === 'gemini' && 'bg-blue-600/20 text-blue-400 border-blue-600/30',
                model === 'groq' && 'bg-orange-600/20 text-orange-400 border-orange-600/30',
                model === 'openrouter' && 'bg-green-600/20 text-green-400 border-green-600/30'
              )}
            >
              {compact ? (specificModel || providerDisplayNames[model]) : `${specificModel || 'unknown'} (${providerDisplayNames[model]})`}
            </span>
          )}
          {responseTime !== undefined && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              {(responseTime / 1000).toFixed(2)}s
            </span>
          )}
          {fallback && (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-600/10 px-2 py-0.5 rounded border border-amber-600/20">
              <AlertCircle className="h-3 w-3" />
              Fallback: {specificModelDisplayNames[fallback.usedModel as keyof typeof specificModelDisplayNames] || fallback.usedModel}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-slate-400 hover:text-slate-100"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {isAssistant && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onFlagBug}
                className="h-7 px-2 text-slate-400 hover:text-rose-400"
                title="Flag as bug"
              >
                <Bug className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSaveToLibrary}
                className="h-7 px-2 text-slate-400 hover:text-emerald-400"
                title="Save to library"
              >
                <Library className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;

              if (isInline) {
                return (
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400" {...props}>
                    {children}
                  </code>
                );
              }

              return (
                <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-slate-300 text-sm" {...props}>
                    {children}
                  </code>
                </pre>
              );
            },
            p({ children }) {
              return <p className="text-slate-300 mb-2 last:mb-0">{children}</p>;
            },
            ul({ children }) {
              return <ul className="text-slate-300 list-disc pl-4 mb-2">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="text-slate-300 list-decimal pl-4 mb-2">{children}</ol>;
            },
            li({ children }) {
              return <li className="mb-1">{children}</li>;
            },
            h1({ children }) {
              return <h1 className="text-xl font-bold text-slate-100 mb-2">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-lg font-bold text-slate-100 mb-2">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-base font-bold text-slate-100 mb-2">{children}</h3>;
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-emerald-500 pl-4 italic text-slate-400">
                  {children}
                </blockquote>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
