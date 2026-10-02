'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import {
  hastText,
  leaveSiteMessage,
  linkClickPlan,
  linkDecision,
  needsHostSuffix,
  openExternal,
  rehypeImagesToText,
  safeUrlTransform,
} from '@/lib/markdown-safety';

/**
 * Renders untrusted markdown (model answers). Images never load, only http(s)
 * links render, every link shows its host and opens in a new tab without opener
 * or referrer, and a host outside lib/trusted-hosts.ts asks before leaving.
 */
export interface SafeMarkdownProps {
  /** The untrusted markdown. */
  children: string;
  /** Styling overrides (code, p, ul, headings...). `a` and `img` are always the safe ones. */
  components?: Omit<Components, 'a' | 'img'>;
}

type PendingLink = { url: string; host: string };

const LeaveSiteContext = createContext<(link: PendingLink) => void>(() => {});

function SafeImage({ alt }: ComponentPropsWithoutRef<'img'> & ExtraProps) {
  // rehypeImagesToText already put `alt (host)` here and removed the URL.
  return <span>{typeof alt === 'string' && alt ? alt : 'image'}</span>;
}

function SafeLink({ href, children, node }: ComponentPropsWithoutRef<'a'> & ExtraProps) {
  const requestLeave = useContext(LeaveSiteContext);
  const decision = linkDecision(href);

  if (decision.kind === 'inert') {
    return <span>{children}</span>;
  }

  const intercept = (event: MouseEvent<HTMLAnchorElement>) => {
    if (linkClickPlan(decision.url) !== 'confirm') return;
    event.preventDefault();
    requestLeave({ url: decision.url, host: decision.host });
  };

  const text = hastText(node);
  return (
    <a
      href={decision.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={intercept}
      onAuxClick={(event) => {
        if (event.button === 1) intercept(event);
      }}
    >
      {children}
      {needsHostSuffix(text, decision.url, decision.host) && (
        <>
          {' '}
          <span className="text-xs text-slate-500">({decision.host})</span>
        </>
      )}
    </a>
  );
}

function LeaveSiteDialog({
  open,
  pending,
  onClose,
}: {
  open: boolean;
  /** The last requested link; kept after close so the exit animation keeps its text. */
  pending: PendingLink | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="bg-black border border-white/[0.08]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-100 text-base">
            {pending ? leaveSiteMessage(pending.host) : ''}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-zinc-400 break-all">
            {pending?.url}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/[0.06] text-zinc-400 hover:bg-white/[0.02]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pending) openExternal(pending.url);
              onClose();
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeImagesToText];

export default function SafeMarkdown({ children, components }: SafeMarkdownProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const requestLeave = useCallback((link: PendingLink) => {
    setPending(link);
    setOpen(true);
  }, []);

  // The safe `a` and `img` go last so a caller's components can never replace them.
  const merged = useMemo<Components>(
    () => ({ ...components, img: SafeImage, a: SafeLink }),
    [components],
  );

  return (
    <LeaveSiteContext.Provider value={requestLeave}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        urlTransform={safeUrlTransform}
        skipHtml
        components={merged}
      >
        {children}
      </ReactMarkdown>
      <LeaveSiteDialog open={open} pending={pending} onClose={() => setOpen(false)} />
    </LeaveSiteContext.Provider>
  );
}
