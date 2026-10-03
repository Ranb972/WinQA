'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { KeyRound, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  hasLegacyKeyBlob,
  readLegacyApiKeys,
  snapshotLegacyKeyStorage,
  wipeLegacyKeyStorage,
} from '@/lib/api-keys';
import { readLegacyCustomProviders } from '@/lib/custom-providers';
import { KeysApiError, keyErrorText } from '@/lib/keys-client';
import {
  BANNER_DISMISSED_KEY,
  BANNER_TEXT,
  buildMigrateBody,
  decideWipe,
  notifyKeysChanged,
  parseMigrateResponse,
  READ_FAILED_MESSAGE,
  subscribeKeysChanged,
  summarizeMove,
} from '@/lib/key-migration';

type Phase =
  | { kind: 'idle' }
  | { kind: 'working' }
  // The browser copy was kept: why (server text or the wipe rules), and Retry.
  | { kind: 'kept'; messages: string[] };

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Offers to move the keys this browser still stores (Batch C, C14) to the
 * account. Signed-in users only, and only while a legacy blob exists. Move
 * uploads, then removes the browser copy only when decideWipe says so; Not now
 * hides the banner for this session; Delete them removes the copy without
 * uploading. After a removal the open pages reload providers and keys.
 */
export default function KeyMigrationBanner({ className = '' }: { className?: string }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const [hasBlob, setHasBlob] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);

  // localStorage is read after mount, never during render (hydration).
  useEffect(() => {
    setDismissed(readDismissed());
    const refresh = () => setHasBlob(hasLegacyKeyBlob());
    refresh();
    return subscribeKeysChanged(refresh);
  }, []);

  const move = useCallback(async () => {
    if (busy.current || !user) return;
    busy.current = true;
    setPhase({ kind: 'working' });
    try {
      const before = snapshotLegacyKeyStorage();
      const [legacyKeys, legacyProviders] = await Promise.all([
        readLegacyApiKeys(user.id),
        readLegacyCustomProviders(user.id),
      ]);
      const decryptFailures = legacyKeys.failed + legacyProviders.failed;
      const body = buildMigrateBody(legacyKeys.keys, legacyProviders.providers);

      let res: Response;
      try {
        res = await fetch('/api/keys/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (error) {
        setPhase({ kind: 'kept', messages: [keyErrorText(error)] });
        return;
      }

      let data: unknown = {};
      try {
        data = await res.json();
      } catch {
        // Not JSON: handled below.
      }

      if (res.status !== 200) {
        const text = (data as { error?: unknown } | null)?.error;
        const error = new KeysApiError(
          typeof text === 'string' && text ? text : `Request failed (HTTP ${res.status})`,
          res.status
        );
        setPhase({ kind: 'kept', messages: [keyErrorText(error)] });
        return;
      }

      const answer = parseMigrateResponse(data);
      if (!answer) {
        setPhase({ kind: 'kept', messages: ['Unexpected answer from the server'] });
        return;
      }

      const summary = summarizeMove(answer.movedCount, answer.skipped);
      toast({
        title: summary.title,
        description:
          summary.lines.length > 0 ? (
            <span className="block whitespace-pre-line break-words">{summary.lines.join('\n')}</span>
          ) : undefined,
      });

      const decision = decideWipe({
        status: res.status,
        skipped: answer.skipped,
        decryptFailures,
        storageChanged: snapshotLegacyKeyStorage() !== before,
      });
      if (decision.wipe) {
        wipeLegacyKeyStorage();
        setPhase({ kind: 'idle' });
        notifyKeysChanged();
      } else {
        setPhase({ kind: 'kept', messages: decision.messages });
      }
    } catch {
      // A damaged blob must not leave the banner stuck on "Moving".
      setPhase({ kind: 'kept', messages: [READ_FAILED_MESSAGE] });
    } finally {
      busy.current = false;
    }
  }, [user, toast]);

  const notNow = () => {
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      // Storage blocked: hidden until the page reloads.
    }
    setDismissed(true);
  };

  const deleteThem = () => {
    wipeLegacyKeyStorage();
    setConfirmDelete(false);
    setPhase({ kind: 'idle' });
    notifyKeysChanged();
    toast({ title: 'Deleted the keys stored in this browser' });
  };

  if (!isLoaded || !isSignedIn || !hasBlob || dismissed) return null;

  const working = phase.kind === 'working';
  const buttonBase =
    'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded text-xs font-mono uppercase tracking-[0.12em] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={className} data-testid="key-migration-banner">
      <div className="rounded border border-orange-500/30 bg-orange-500/[0.06] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3 min-w-0">
            <KeyRound className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-zinc-300">{BANNER_TEXT}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void move()}
              disabled={working}
              className={`${buttonBase} bg-orange-500 hover:bg-orange-400 text-black`}
            >
              {working && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {working ? 'Moving' : phase.kind === 'kept' ? 'Retry' : 'Move'}
            </button>
            <button
              type="button"
              onClick={notNow}
              disabled={working}
              className={`${buttonBase} border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04]`}
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={working}
              className={`${buttonBase} border border-red-500/30 text-red-400 hover:bg-red-500/10`}
            >
              Delete them
            </button>
          </div>
        </div>
        {phase.kind === 'kept' && (
          <div className="mt-3 text-sm text-zinc-300" role="status">
            {phase.messages.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-black border border-white/[0.08]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 font-mono text-xs uppercase tracking-[0.16em]">
              Delete the keys stored in this browser?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-zinc-400">
              They are removed from this browser and not moved to your account. You will need to add
              them again in Settings. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/[0.06] text-zinc-400 hover:bg-white/[0.02] font-mono text-xs uppercase tracking-[0.12em] min-h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteThem}
              className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs uppercase tracking-[0.12em] min-h-11"
            >
              Delete them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
