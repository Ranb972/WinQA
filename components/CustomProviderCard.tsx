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
  toggleIntent,
  MISSING_KEY_TEXT,
} from '@/lib/custom-providers';

interface CustomProviderCardProps {
  provider: CustomProvider;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<CustomProviderTestResult>;
  /**
   * Sets the enabled state to `next` (a target, never a flip). The card passes
   * false to turn off and true only after a passing test, and keeps the switch
   * busy until the returned promise settles.
   */
  onToggle: (next: boolean) => void | Promise<void>;
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
  // A switch action (turn-on test or enabled-state write) is running. The ref is
  // the same flag, read synchronously so a second click cannot slip through.
  const [toggleBusy, setToggleBusy] = useState(false);
  const toggleBusyRef = useRef(false);
  // The enabled-state write in flight (never rejects). A Remove waits for it,
  // because both rewrite the stored provider list.
  const pendingWrite = useRef<Promise<void> | null>(null);
  // Clears a shown test pass after RESET_MS. Test results only.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hides the Remove confirmation after RESET_MS. Separate, so a test result can
  // neither replace nor cancel it.
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by every test and by a confirmed Remove; a response from an older
  // test is ignored.
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

  const hideDeleteConfirm = () => {
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
    setShowDeleteConfirm(false);
  };

  // On unmount: stop both timers and drop any in-flight test (no toggle after removal).
  useEffect(() => {
    const seqRef = requestSeq;
    const resetRef = resetTimer;
    const confirmRef = confirmTimer;
    return () => {
      seqRef.current += 1;
      if (resetRef.current) clearTimeout(resetRef.current);
      if (confirmRef.current) clearTimeout(confirmRef.current);
    };
  }, []);

  const testing = testStatus === 'testing';
  const switchBusy = testing || toggleBusy;
  // Off with no usable key (e.g. decryption failed): a test cannot pass.
  const turnOnBlocked = !provider.enabled && !provider.apiKey;

  // Runs the server-side test and shows the result. A pass clears itself after
  // RESET_MS; a failure stays until the next action. Returns null when stale.
  const runTest = async (): Promise<CustomProviderTestResult | null> => {
    clearResetTimer();
    hideDeleteConfirm();
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
    // aria-disabled while testing (keeps keyboard focus): ignore the click.
    if (testing) return;
    await runTest();
  };

  // Writes the target state through onToggle. A failed write leaves the page
  // state, and so the switch, on the stored value.
  const writeEnabled = async (next: boolean) => {
    const write = (async () => {
      await onToggle(next);
    })().catch(() => undefined);
    pendingWrite.current = write;
    await write;
    if (pendingWrite.current === write) pendingWrite.current = null;
  };

  // Turning off is immediate. Turning on tests first and stays off on failure.
  // The switch stays busy (aria-disabled) until the test and the write settle.
  const handleToggle = async () => {
    const intent = toggleIntent({
      enabled: provider.enabled,
      hasKey: !!provider.apiKey,
      busy: toggleBusyRef.current || testing,
    });
    if (intent === 'ignore') return;
    if (intent === 'missing-key') {
      clearResetTimer();
      setTestStatus('invalid');
      setTestMessage({ text: MISSING_KEY_TEXT, detail: null });
      return;
    }

    toggleBusyRef.current = true;
    setToggleBusy(true);
    try {
      if (intent === 'turn-off') {
        // A new action: drop a shown test result and its pending reset.
        clearResetTimer();
        setTestStatus('idle');
        setTestMessage(null);
        await writeEnabled(false);
        return;
      }
      // runTest bumps requestSeq synchronously; a later bump (newer test, Remove,
      // unmount) means this pass no longer counts.
      const pending = runTest();
      const seq = requestSeq.current;
      const result = await pending;
      if (result?.valid && seq === requestSeq.current) {
        await writeEnabled(true);
      }
    } finally {
      toggleBusyRef.current = false;
      setToggleBusy(false);
    }
  };

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      // Drop a running test first: the card stays mounted during its exit
      // animation, so a late pass must not turn on a removed provider.
      requestSeq.current += 1;
      clearResetTimer();
      hideDeleteConfirm();
      setTestStatus('idle');
      setTestMessage(null);
      // Let an enabled-state write land before the removal rewrites storage.
      if (pendingWrite.current) await pendingWrite.current;
      onDelete();
    } else {
      // A new action: drop a shown test result (an in-flight test keeps running).
      if (!testing) {
        clearResetTimer();
        setTestStatus('idle');
        setTestMessage(null);
      }
      setShowDeleteConfirm(true);
      // Auto-hide the confirmation after RESET_MS, on its own timer.
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => {
        confirmTimer.current = null;
        setShowDeleteConfirm(false);
      }, RESET_MS);
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
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
            {testStatus === 'invalid' && (
              <span className="flex items-center gap-1 text-xs text-rose-400">
                <X className="h-3 w-3" aria-hidden="true" />
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
            aria-label={`${provider.name} enabled`}
            title={turnOnBlocked ? MISSING_KEY_TEXT : provider.enabled ? 'Turn off' : 'Turn on'}
            onClick={handleToggle}
            aria-disabled={switchBusy || turnOnBlocked}
            aria-busy={switchBusy}
            className={`h-11 min-w-11 px-1 flex items-center justify-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              switchBusy ? 'cursor-wait' : turnOnBlocked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
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
                className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
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
            disabled={!provider.apiKey}
            aria-disabled={testing}
            className={`h-11 w-11 transition-colors aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ${
              testStatus === 'valid'
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                : testStatus === 'invalid'
                ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'
            }`}
            aria-label={`Test connection for ${provider.name}`}
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
            aria-label={`Edit ${provider.name}`}
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
            aria-label={
              showDeleteConfirm ? `Click again to remove ${provider.name}` : `Remove ${provider.name}`
            }
            title={showDeleteConfirm ? 'Click again to remove' : 'Remove'}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
