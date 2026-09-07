// Single source of truth for the built-in model lineup.
//
// Every id the UI can offer, the fallback engine can call, or a leaderboard row can be
// keyed on comes from MODEL_REGISTRY. Order matters: the first entry of each provider
// is that provider's default and the head of its fallback chain. UI catalogues
// (PROVIDER_MODELS), the runtime chain (fallbackChains), display names and the id
// types are all derived from it, so the lineup cannot drift between them.
//
// Lineup rule (owner decision, 2026-09-07): one model family per provider, up to
// three entries from that family, never a mix of families under one provider, and
// never filled from another family when the catalogue has fewer than three.
//
// Provenance: each entry records the official page it was verified against and the
// date. Documentation is a lagging signal. On 2026-09-06 the docs check recorded
// Groq's llama-3.3-70b-versatile and llama-3.1-8b-instant as live; on 2026-09-07 a
// live call to llama-3.3-70b-versatile returned 404 model_not_found, and Groq's
// deprecations page dates their shutdown to 2026-08-16. Live probes, not
// documentation pages, are the source of truth for whether an id answers; the
// model-radar feature (E2) exists to run them on a schedule. Every id below answered
// a live probe on its verifiedOn date, through this repository's own adapters.
import type { LLMProvider } from './types';

export interface ModelEntry {
  /** Exact id sent to the provider. */
  readonly id: string;
  /** The provider's real product name for this id. Unique across the registry. */
  readonly name: string;
  /** One line for pickers. */
  readonly description: string;
  /** Official page the id was verified against. */
  readonly source: string;
  /** Date of that verification, YYYY-MM-DD. */
  readonly verifiedOn: string;
}

export const MODEL_REGISTRY = {
  // Command family. Trial keys: 20 req/min, 1,000 calls/month (docs.cohere.com/docs/rate-limits).
  // command-a-plus-05-2026 is live on docs.cohere.com but the 2026-09-07 probe returned
  // 400 "this model is not supported with '/v1/chat', please use '/v2/chat'": it needs
  // the Cohere v2 client (cohere-ai CohereClientV2), which this codebase does not use.
  cohere: [
    {
      id: 'command-a-03-2025',
      name: 'Command A',
      description: 'Newest, strongest',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'command-r-plus-08-2024',
      name: 'Command R+',
      description: 'Previous generation',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'command-r-08-2024',
      name: 'Command R',
      description: 'Previous generation, smaller',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-07',
    },
  ],
  // Gemini Flash family, two generations. All four are "free of charge" on the free
  // tier (ai.google.dev/gemini-api/docs/pricing); numeric limits live in AI Studio.
  gemini: [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      description: 'Newest Flash',
      source: 'https://ai.google.dev/gemini-api/docs/models',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash Lite',
      description: 'Lightweight, fast',
      source: 'https://ai.google.dev/gemini-api/docs/models',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Previous generation',
      source: 'https://ai.google.dev/gemini-api/docs/models',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite',
      description: 'Previous generation, lightweight',
      source: 'https://ai.google.dev/gemini-api/docs/models',
      verifiedOn: '2026-09-07',
    },
  ],
  // GPT-OSS family: Groq's only production family with more than one chat model on
  // a developer key. Free tier per model: 30 RPM, 1K RPD, 8K TPM, 200K TPD
  // (console.groq.com/docs/rate-limits). Two entries; the catalogue has no third.
  groq: [
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT-OSS 120B',
      description: 'Most capable',
      source: 'https://console.groq.com/docs/models',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'openai/gpt-oss-20b',
      name: 'GPT-OSS 20B',
      description: 'Faster, smaller',
      source: 'https://console.groq.com/docs/models',
      verifiedOn: '2026-09-07',
    },
  ],
  // MiniMax family: the only lab with more than one :free chat model in OpenRouter's
  // live catalogue on 2026-09-07 (Qwen and DeepSeek had none). Free variants: 20 RPM,
  // 50 RPD, 1,000 RPD with $10 lifetime credit (openrouter.ai/docs/api-reference/limits).
  openrouter: [
    {
      id: 'minimax/minimax-m3:free',
      name: 'MiniMax M3',
      description: 'Free tier, 1M context',
      source: 'https://openrouter.ai/minimax/minimax-m3:free',
      verifiedOn: '2026-09-07',
    },
    {
      id: 'minimax/minimax-m2.7:free',
      name: 'MiniMax M2.7',
      description: 'Free tier, previous generation',
      source: 'https://openrouter.ai/minimax/minimax-m2.7:free',
      verifiedOn: '2026-09-07',
    },
  ],
} as const satisfies Record<LLMProvider, readonly ModelEntry[]>;

// Id types derived from the registry, so an id that is not in the lineup does not
// type-check anywhere in the runtime.
export type CohereModel = (typeof MODEL_REGISTRY)['cohere'][number]['id'];
export type GeminiModel = (typeof MODEL_REGISTRY)['gemini'][number]['id'];
export type GroqModel = (typeof MODEL_REGISTRY)['groq'][number]['id'];
export type OpenRouterModel = (typeof MODEL_REGISTRY)['openrouter'][number]['id'];
export type SpecificModel = CohereModel | GeminiModel | GroqModel | OpenRouterModel;

export const REGISTRY_PROVIDERS: readonly LLMProvider[] = ['cohere', 'gemini', 'groq', 'openrouter'];

/** Entries for one provider, widened to the plain interface for iteration. */
export function registryEntries(provider: LLMProvider): readonly ModelEntry[] {
  return MODEL_REGISTRY[provider];
}

const ALL_ENTRIES: readonly ModelEntry[] = REGISTRY_PROVIDERS.flatMap((p) => registryEntries(p));

/** Total number of registered ids; the longest fallback sequence any call can walk. */
export const REGISTRY_MODEL_COUNT = ALL_ENTRIES.length;

// Fallback chains: ordered from preferred to least preferred, per provider.
export const fallbackChains: Record<LLMProvider, SpecificModel[]> = Object.fromEntries(
  REGISTRY_PROVIDERS.map((p) => [p, registryEntries(p).map((m) => m.id as SpecificModel)])
) as Record<LLMProvider, SpecificModel[]>;

// Default model for each provider: the head of its chain.
export const defaultModels: Record<LLMProvider, SpecificModel> = Object.fromEntries(
  REGISTRY_PROVIDERS.map((p) => [p, registryEntries(p)[0].id as SpecificModel])
) as Record<LLMProvider, SpecificModel>;

// Display names and one-line descriptions for specific models (for UI).
export const specificModelDisplayNames: Record<SpecificModel, string> = Object.fromEntries(
  ALL_ENTRIES.map((m) => [m.id, m.name])
) as Record<SpecificModel, string>;

export const modelDescriptions: Record<SpecificModel, string> = Object.fromEntries(
  ALL_ENTRIES.map((m) => [m.id, m.description])
) as Record<SpecificModel, string>;

/** The registry entry for (provider, id), or undefined when either is unknown. */
export function getRegisteredModel(provider: string, id: string): ModelEntry | undefined {
  if (!REGISTRY_PROVIDERS.includes(provider as LLMProvider)) return undefined;
  return registryEntries(provider as LLMProvider).find((m) => m.id === id);
}

/** True when `id` is a registered model of `provider`. */
export function isRegisteredModel(provider: string, id: unknown): id is SpecificModel {
  return typeof id === 'string' && getRegisteredModel(provider, id) !== undefined;
}

/**
 * Keep only preferences that name a registered model of a known provider. Stored
 * preferences outlive lineups (localStorage), so anything else is dropped rather
 * than sent to the API, where it would be rejected.
 */
export function sanitizeModelPreferences(
  prefs: Record<string, unknown> | null | undefined
): Partial<Record<LLMProvider, SpecificModel>> {
  const clean: Partial<Record<LLMProvider, SpecificModel>> = {};
  if (!prefs || typeof prefs !== 'object') return clean;
  for (const provider of REGISTRY_PROVIDERS) {
    const id = prefs[provider];
    if (isRegisteredModel(provider, id)) clean[provider] = id;
  }
  return clean;
}
