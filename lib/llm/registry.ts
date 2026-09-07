// Single source of truth for the built-in model lineup.
//
// Every id the UI can offer, the fallback engine can call, or a leaderboard row can be
// keyed on comes from MODEL_REGISTRY. Order matters: the first entry of each provider
// is that provider's default and the head of its fallback chain. UI catalogues
// (PROVIDER_MODELS), the runtime chain (fallbackChains), display names and the id
// types are all derived from it, so the lineup cannot drift between them.
//
// Provenance: each entry records the official page it was verified against and the
// date. Documentation is a lagging signal. On 2026-09-06 the docs check recorded
// Groq's llama-3.3-70b-versatile and llama-3.1-8b-instant as live; on 2026-09-07 a
// live call to llama-3.3-70b-versatile returned 404 model_not_found, and Groq's
// deprecations page dates their shutdown to 2026-08-16. Live probes, not
// documentation pages, are the source of truth for whether an id answers; the
// model-radar feature (E2) exists to run them on a schedule.
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
  cohere: [
    {
      id: 'command-a-03-2025',
      name: 'Command A',
      description: 'Newest, strongest',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-06',
    },
    {
      id: 'command-r-plus-08-2024',
      name: 'Command R+',
      description: 'Very capable',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-06',
    },
    {
      id: 'command-r-08-2024',
      name: 'Command R',
      description: 'Balanced',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-06',
    },
    {
      id: 'command-r7b-12-2024',
      name: 'Command R7B',
      description: 'Smallest, fastest',
      source: 'https://docs.cohere.com/docs/models',
      verifiedOn: '2026-09-06',
    },
  ],
  gemini: [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Latest, most capable',
      source: 'https://ai.google.dev/gemini-api/docs/models',
      verifiedOn: '2026-09-06',
    },
    {
      id: 'gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite',
      description: 'Lightweight',
      source: 'https://ai.google.dev/gemini-api/docs/models',
      verifiedOn: '2026-09-06',
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      description: 'Most capable',
      source: 'https://console.groq.com/docs/models',
      verifiedOn: '2026-09-06',
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B',
      description: 'Faster, smaller',
      source: 'https://console.groq.com/docs/models',
      verifiedOn: '2026-09-06',
    },
  ],
  openrouter: [
    {
      id: 'nvidia/nemotron-3-nano-30b-a3b:free',
      name: 'Nemotron 3 Nano 30B',
      description: 'Free tier',
      source: 'https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b:free',
      verifiedOn: '2026-09-06',
    },
    {
      id: 'nvidia/nemotron-nano-9b-v2:free',
      name: 'Nemotron Nano 9B',
      description: 'Free tier, smaller',
      source: 'https://openrouter.ai/nvidia/nemotron-nano-9b-v2:free',
      verifiedOn: '2026-09-06',
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
