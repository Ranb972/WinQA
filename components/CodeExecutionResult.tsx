'use client';

import { CheckCircle, XCircle, Bot, Cpu, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeExecutionResult, isInteractiveHTML, requiresDevEnvironment, wrapJSInHTML } from '@/lib/code-execution';
import InteractivePreview from '@/components/InteractivePreview';
import DevEnvironmentRequired from '@/components/DevEnvironmentRequired';

interface CodeExecutionResultDisplayProps {
  result: CodeExecutionResult;
  code?: string;
  onDebugClick?: () => void;
  onSuccessAnalysisClick?: () => void;
}

export default function CodeExecutionResultDisplay({
  result,
  code,
  onDebugClick,
  onSuccessAnalysisClick,
}: CodeExecutionResultDisplayProps) {
  const hasOutput = result.output && result.output.trim().length > 0;
  const hasError = result.error && result.error.trim().length > 0;

  // Determine preview mode
  const showInteractivePreview = code && isInteractiveHTML(code) && !requiresDevEnvironment(code);
  const showDevEnvironmentWarning = code && requiresDevEnvironment(code);
  const previewCode = showInteractivePreview && code
    ? (code.includes('<html') || code.includes('<body') ? code : wrapJSInHTML(code))
    : null;
  const isWrapped = Boolean(showInteractivePreview && code && !code.includes('<html') && !code.includes('<body'));

  return (
    <div
      className={cn(
        'mt-2 p-3 font-mono text-sm',
        result.success
          ? 'border border-green-900/40 bg-green-950/30'
          : 'border border-red-900/40 bg-red-950/25'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/30 mb-2">
        <span
          className={cn(
            'flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em]',
            result.success ? 'text-green-400' : 'text-red-400'
          )}
        >
          {result.success ? (
            <CheckCircle className="w-[13px] h-[13px] text-green-500" />
          ) : (
            <XCircle className="w-[13px] h-[13px] text-red-400" />
          )}
          {result.success ? 'Execution Success' : 'Execution Failed'}
        </span>

        <div className="flex items-center gap-2">
          {/* Engine indicator */}
          {result.engine && (
            <span className="flex items-center gap-1 font-mono text-[10px] tracking-[0.08em] text-white/30">
              <Cpu className="h-3 w-3" />
              {result.engine}
            </span>
          )}

          {/* Execution time */}
          {result.executionTime !== undefined && (
            <span className="font-mono text-[10px] tracking-[0.08em] text-white/30">
              {result.executionTime.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>

      {/* Output */}
      {hasOutput && (
        <div className="mb-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 mb-2">Output:</div>
          <pre className="font-mono text-sm text-green-300 bg-green-950/40 border border-green-900/30 px-4 py-3 whitespace-pre-wrap overflow-x-auto">
            {result.output}
          </pre>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 mb-2">Error:</div>
          <pre className="font-mono text-xs text-red-300/80 leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {result.error}
          </pre>
        </div>
      )}

      {/* No output message */}
      {result.success && !hasOutput && !showInteractivePreview && (
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
          Code executed successfully with no output.
        </div>
      )}

      {/* Interactive Preview (for HTML/DOM code) */}
      {result.success && showInteractivePreview && previewCode && (
        <InteractivePreview code={previewCode} originalCode={code} isWrapped={isWrapped} />
      )}

      {/* Dev Environment Warning (for React/Vue/Node code) */}
      {showDevEnvironmentWarning && code && (
        <DevEnvironmentRequired code={code} />
      )}

      {/* Debug button (only on error) */}
      {!result.success && onDebugClick && (
        <button
          onClick={onDebugClick}
          className="flex items-center gap-2 px-3 py-1.5 mt-4 border border-orange-500/30 bg-orange-500/[0.08] hover:bg-orange-500/[0.15] hover:border-orange-500/50 text-orange-400 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
        >
          <Bot className="w-[11px] h-[11px]" />
          AI Debug
        </button>
      )}

      {/* What Worked button (only on success) */}
      {result.success && onSuccessAnalysisClick && (
        <button
          onClick={onSuccessAnalysisClick}
          className="flex items-center gap-2 px-3 py-1.5 mt-4 border border-green-700/30 bg-green-950/30 hover:bg-green-900/30 text-green-400 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
        >
          <Target className="w-[11px] h-[11px]" />
          What Worked?
        </button>
      )}
    </div>
  );
}
