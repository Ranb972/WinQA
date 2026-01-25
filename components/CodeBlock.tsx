'use client';

import { useState } from 'react';
import { Play, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CodeExecutionResult,
  isSupportedLanguage,
  normalizeLanguage,
  getLanguageDisplayName,
} from '@/lib/code-execution';
import CodeExecutionResultDisplay from '@/components/CodeExecutionResult';
import DebugModelSelector, { DebugMode } from '@/components/DebugModelSelector';
import { LLMProvider } from '@/lib/llm';
import { CustomProvider } from '@/lib/custom-providers';
import { useToast } from '@/hooks/use-toast';

interface CodeBlockProps {
  code: string;
  language: string;
  onDebugRequest?: (code: string, error: string, model: LLMProvider | string, mode: DebugMode) => void;
  onSuccessAnalysisRequest?: (code: string, output: string | undefined, model: LLMProvider | string, mode: DebugMode) => void;
  customProviders?: CustomProvider[];
}

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  js: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  python: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  py: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  typescript: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  ts: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
};

export default function CodeBlock({
  code,
  language,
  onDebugRequest,
  onSuccessAnalysisRequest,
  customProviders,
}: CodeBlockProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CodeExecutionResult | null>(null);
  const [showDebugSelector, setShowDebugSelector] = useState(false);
  const [showSuccessSelector, setShowSuccessSelector] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const normalizedLang = normalizeLanguage(language);
  const isExecutable = isSupportedLanguage(language);
  const displayName = getLanguageDisplayName(language);
  const langColorClass = LANGUAGE_COLORS[language.toLowerCase()] || 'bg-slate-700/50 text-slate-400 border-slate-600/30';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Code copied',
      description: 'Code copied to clipboard',
    });
  };

  const handleRun = async () => {
    if (!normalizedLang) return;

    setIsRunning(true);
    setResult(null);
    setShowDebugSelector(false);

    try {
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: normalizedLang,
          code,
        }),
      });

      const data: CodeExecutionResult = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error. Please try again.',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleDebugSelect = (model: LLMProvider | string, mode: DebugMode) => {
    if (result?.error && onDebugRequest) {
      onDebugRequest(code, result.error, model, mode);
    }
    setShowDebugSelector(false);
  };

  const handleSuccessAnalysisSelect = (model: LLMProvider | string, mode: DebugMode) => {
    if (result?.success && onSuccessAnalysisRequest) {
      onSuccessAnalysisRequest(code, result.output, model, mode);
    }
    setShowSuccessSelector(false);
  };

  return (
    <div className="relative group my-3">
      {/* Header: Language badge + actions */}
      <div className="flex items-center justify-between bg-slate-800/80 rounded-t-lg px-3 py-2 border-b border-slate-700/50">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded border font-medium',
            langColorClass
          )}
        >
          {displayName}
        </span>

        <div className="flex items-center gap-1">
          {/* Copy button */}
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

          {/* Run button (only for supported languages) */}
          {isExecutable && (
            <Button
              onClick={handleRun}
              disabled={isRunning}
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-medium',
                'bg-gradient-to-r from-emerald-600 to-teal-600',
                'hover:from-emerald-500 hover:to-teal-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Run
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Code content */}
      <pre className="bg-slate-900 rounded-b-lg p-4 overflow-x-auto">
        <code className="text-slate-300 text-sm">{code}</code>
      </pre>

      {/* Execution result */}
      {result && (
        <CodeExecutionResultDisplay
          result={result}
          code={code}
          onDebugClick={() => setShowDebugSelector(true)}
          onSuccessAnalysisClick={() => setShowSuccessSelector(true)}
        />
      )}

      {/* Debug model selector */}
      {showDebugSelector && result && !result.success && (
        <DebugModelSelector
          onSelect={handleDebugSelect}
          onClose={() => setShowDebugSelector(false)}
          customProviders={customProviders}
          analysisType="debug"
        />
      )}

      {/* Success analysis model selector */}
      {showSuccessSelector && result && result.success && (
        <DebugModelSelector
          onSelect={handleSuccessAnalysisSelect}
          onClose={() => setShowSuccessSelector(false)}
          customProviders={customProviders}
          analysisType="success"
        />
      )}
    </div>
  );
}
