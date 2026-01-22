'use client';

import { CheckCircle, XCircle, Bot, Cpu, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        'mt-2 rounded-lg p-3 font-mono text-sm',
        result.success
          ? 'bg-emerald-950/30 border border-emerald-500/30'
          : 'bg-rose-950/30 border border-rose-500/30'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            result.success ? 'text-emerald-400' : 'text-rose-400'
          )}
        >
          {result.success ? (
            <CheckCircle className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {result.success ? 'Success' : 'Error'}
        </span>

        <div className="flex items-center gap-2">
          {/* Engine indicator */}
          {result.engine && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Cpu className="h-3 w-3" />
              {result.engine}
            </span>
          )}

          {/* Execution time */}
          {result.executionTime !== undefined && (
            <span className="text-xs text-slate-500">
              {result.executionTime.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>

      {/* Output */}
      {hasOutput && (
        <div className="mb-2">
          <div className="text-xs text-slate-500 mb-1">Output:</div>
          <pre className="whitespace-pre-wrap text-slate-300 bg-slate-900/50 rounded p-2 overflow-x-auto">
            {result.output}
          </pre>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div>
          <div className="text-xs text-rose-400/70 mb-1">Error:</div>
          <pre className="whitespace-pre-wrap text-rose-300 bg-rose-950/30 rounded p-2 overflow-x-auto">
            {result.error}
          </pre>
        </div>
      )}

      {/* No output message */}
      {result.success && !hasOutput && !showInteractivePreview && (
        <div className="text-xs text-slate-500 italic">
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
        <Button
          onClick={onDebugClick}
          variant="outline"
          size="sm"
          className="mt-3 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Bot className="h-4 w-4 mr-1.5" />
          AI Debug
        </Button>
      )}

      {/* What Worked button (only on success) */}
      {result.success && onSuccessAnalysisClick && (
        <Button
          onClick={onSuccessAnalysisClick}
          variant="ghost"
          size="sm"
          className="mt-3 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
        >
          <Target className="h-4 w-4 mr-1.5" />
          What Worked?
        </Button>
      )}
    </div>
  );
}
