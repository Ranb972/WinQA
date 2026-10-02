'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Edit2,
  Trash2,
  FlaskConical,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CustomProvider,
  CustomProviderTestResult,
  friendlyTestFailure,
  formatTestPassed,
} from '@/lib/custom-providers';

interface CustomProviderCardProps {
  provider: CustomProvider;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<CustomProviderTestResult>;
  onToggle: () => void;
}

type TestStatus = 'idle' | 'testing' | 'valid' | 'invalid';

// Status line text: one line, plus the redacted raw error on a second line on failure.
type TestMessage = { text: string; detail: string | null };

// How long a pass (and the remove confirmation) stays visible.
const RESET_MS = 3000;

export default function CustomProviderCard({
  provider,
  onEdit,
  onDelete,
  onTest,
  onToggle,
}: CustomProviderCardProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<TestMessage | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // One timer for every delayed reset; cleared on each new action and on unmount.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by every test; a response from an older test is ignored.
  const requestSeq = useRef(0);

  const clearResetTimer = () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  };

  const scheduleReset = (fn: () => void) => {
    clearResetTimer();
    resetTimer.current = setTimeout(() => {
      resetTimer.current = null;
      fn();
    }, RESET_MS);
  };

  // On unmount: stop the timer and drop any in-flight test (no toggle after removal).
  useEffect(() => {
    const seqRef = requestSeq;
    const timerRef = resetTimer;
    return () => {
      seqRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Runs the server-side test and shows the result. A pass clears itself after
  // RESET_MS; a failure stays until the next action. Returns null when stale.
  const runTest = async (): Promise<CustomProviderTestResult | null> => {
    clearResetTimer();
    setShowDeleteConfirm(false);
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setTestStatus('testing');
    setTestMessage(null);

    const result = await onTest();
    if (seq !== requestSeq.current) {
      return null;
    }

    if (result.valid) {
      setTestStatus('valid');
      setTestMessage({ text: formatTestPassed(result), detail: null });
      scheduleReset(() => {
        setTestStatus('idle');
        setTestMessage(null);
      });
    } else {
      const failure = friendlyTestFailure(result, provider.apiKey);
      setTestStatus('invalid');
      setTestMessage({
        text: failure.statusText ? `${failure.reason} · ${failure.statusText}` : failure.reason,
        detail: failure.detail,
      });
    }
    return result;
  };

  const handleTest = async () => {
    await runTest();
  };

  // Turning off is immediate. Turning on tests first and stays off on failure.
  const handleToggle = async () => {
    if (provider.enabled) {
      // A new action: drop a shown test result and its pending reset.
      clearResetTimer();
      setTestStatus('idle');
      setTestMessage(null);
      onToggle();
      return;
    }
    const result = await runTest();
    if (result?.valid) {
      onToggle();
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      clearResetTimer();
      onDelete();
      setShowDeleteConfirm(false);
    } else {
      // A new action: drop a shown test result (an in-flight test keeps running).
      if (testStatus !== 'testing') {
        setTestStatus('idle');
        setTestMessage(null);
      }
      setShowDeleteConfirm(true);
      // Auto-hide confirmation after RESET_MS
      scheduleReset(() => setShowDeleteConfirm(false));
    }
  };

  // Truncate URL for display
  const displayUrl = (() => {
    try {
      const url = new URL(provider.baseUrl);
      return url.hostname;
    } catch {
      return provider.baseUrl.slice(0, 30) + (provider.baseUrl.length > 30 ? '...' : '');
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`p-4 rounded-xl border transition-colors ${
        provider.enabled
          ? 'bg-slate-800/50 border-violet-500/30'
          : 'bg-slate-900/30 border-slate-700/30 opacity-60'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        {/* Provider Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-slate-200 truncate">
              {provider.name}
            </h3>
            {testStatus === 'valid' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="h-3 w-3" />
              </span>
            )}
            {testStatus === 'invalid' && (
              <span className="flex items-center gap-1 text-xs text-rose-400">
                <X className="h-3 w-3" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate" title={provider.baseUrl}>
              {displayUrl}
            </span>
            <span className="text-slate-600">|</span>
            <code className="text-violet-400 truncate" title={provider.modelId}>
              {provider.modelId}
            </code>
          </div>

          {/* Always rendered so screen readers announce every change */}
          <p
            role="status"
            aria-live="polite"
            className={`text-xs break-words ${testStatus === 'idle' ? '' : 'mt-1'} ${
              testStatus === 'testing'
                ? 'text-slate-400'
                : testStatus === 'valid'
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {testStatus === 'testing' ? (
              'Testing connection…'
            ) : testMessage ? (
              <>
                {testMessage.text}
                {testMessage.detail && (
                  <span className="block mt-0.5 text-slate-500">{testMessage.detail}</span>
                )}
              </>
            ) : null}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap sm:flex-shrink-0">
          {/* Toggle: 44 px target around the 40x20 visual switch */}
          <button
            type="button"
            role="switch"
            aria-checked={provider.enabled}
            aria-label={provider.enabled ? 'Turn off' : 'Turn on'}
            title={provider.enabled ? 'Turn off' : 'Turn on'}
            onClick={handleToggle}
            disabled={testStatus === 'testing'}
            aria-busy={testStatus === 'testing'}
            className="h-11 min-w-11 px-1 flex items-center justify-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-wait"
          >
            {testStatus === 'testing' && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
            )}
            <span
              aria-hidden="true"
              className={`relative block shrink-0 w-10 h-5 rounded-full transition-colors ${
                provider.enabled ? 'bg-violet-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  provider.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          {/* Test Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTest}
            disabled={testStatus === 'testing' || !provider.apiKey}
            className={`h-11 w-11 transition-colors ${
              testStatus === 'valid'
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                : testStatus === 'invalid'
                ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'
            }`}
            aria-label="Test connection"
            title="Test connection"
          >
            {testStatus === 'testing' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          {/* Edit Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-11 w-11 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10"
            aria-label="Edit"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className={`h-11 w-11 transition-colors ${
              showDeleteConfirm
                ? 'text-rose-400 bg-rose-500/20 hover:bg-rose-500/30'
                : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
            }`}
            aria-label={showDeleteConfirm ? 'Click again to remove' : 'Remove'}
            title={showDeleteConfirm ? 'Click again to remove' : 'Remove'}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
