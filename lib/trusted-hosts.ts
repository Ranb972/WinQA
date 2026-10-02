/**
 * Hosts a link in a model answer may open without the "You are leaving WinQA" confirm.
 *
 * Every other http(s) host still renders as a link, but a click asks first
 * (components/SafeMarkdown.tsx). Matching is the exact host or `www.` + host,
 * never a suffix, so `github.com.evil.example` and `evil-github.com` are untrusted.
 *
 * Sources: hosts WinQA itself links to (app footer, About/Privacy/Terms, the
 * Settings "Acquire Key" buttons, the model registry `source` docs and the custom
 * provider preset docs in lib/llm/models.ts) plus the owner's list of reference sites.
 * This is the only place the list lives; add a host here and nowhere else.
 */
export const TRUSTED_HOSTS: readonly string[] = [
  // WinQA itself and its repository
  'winqa.ai',
  'github.com',
  // Built-in providers: docs, consoles and key pages
  'cohere.com',
  'docs.cohere.com',
  'dashboard.cohere.com',
  'ai.google.dev',
  'aistudio.google.com',
  'groq.com',
  'console.groq.com',
  'mistral.ai',
  'docs.mistral.ai',
  'console.mistral.ai',
  'openrouter.ai',
  // Custom provider preset docs (lib/llm/models.ts)
  'developers.openai.com',
  'platform.claude.com',
  'docs.together.ai',
  'fireworks.ai',
  'api-docs.deepseek.com',
  // General references
  'developer.mozilla.org',
  'en.wikipedia.org',
  'stackoverflow.com',
];

const TRUSTED = new Set(TRUSTED_HOSTS);

/** True when `host` is on the list exactly, or is `www.` + a listed host. Case-insensitive. */
export function isTrustedHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  if (TRUSTED.has(h)) return true;
  return h.startsWith('www.') && TRUSTED.has(h.slice(4));
}
