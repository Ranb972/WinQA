import { describe, it, expect } from 'vitest';
import {
  MODEL_REGISTRY,
  REGISTRY_PROVIDERS,
  REGISTRY_MODEL_COUNT,
  registryEntries,
  fallbackChains,
  defaultModels,
  specificModelDisplayNames,
  modelDescriptions,
  isRegisteredModel,
  sanitizeModelPreferences,
} from '@/lib/llm/registry';
import { PROVIDER_MODELS, COMMON_CUSTOM_PROVIDERS, getDefaultModel, getModelDisplayName } from '@/lib/llm/models';

// Ids retired by their providers: AUDIT_2026-09.md section 3.3 plus what the
// 2026-09-07 live probe found. None may reappear in the registry or the presets.
const RETIRED_IDS = [
  // Cohere aliases deprecated 2025-09-15
  'command-r-plus',
  'command-r',
  // Groq: mixtral shut down 2025-03-20; both Llama ids shut down 2026-08-16
  'mixtral-8x7b-32768',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  // OpenRouter: absent from the live catalogue
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'deepseek/deepseek-r1-0528:free',
  // Custom-provider presets
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'llama-3.1-sonar-small-128k-online',
  'llama-3.1-sonar-large-128k-online',
  'meta-llama/Llama-3-70b-chat-hf',
  'meta-llama/Llama-3-8b-chat-hf',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'accounts/fireworks/models/llama-v3-70b-instruct',
];

// One family per provider (owner decision 2026-09-07): every id of a provider shares
// the family prefix. Change the prefix here when the lineup changes family on purpose.
const FAMILY_PREFIX = {
  cohere: 'command-',
  gemini: 'gemini-',
  groq: 'openai/gpt-oss-',
  openrouter: 'minimax/',
} as const;

const allEntries = REGISTRY_PROVIDERS.flatMap((p) => registryEntries(p));

describe('model registry: shape and provenance', () => {
  it('covers the four built-in providers and nothing else', () => {
    expect(Object.keys(MODEL_REGISTRY).sort()).toEqual(['cohere', 'gemini', 'groq', 'openrouter']);
    expect([...REGISTRY_PROVIDERS].sort()).toEqual(['cohere', 'gemini', 'groq', 'openrouter']);
  });

  it('has at least one and at most four entries per provider (Gemini spans two generations)', () => {
    for (const p of REGISTRY_PROVIDERS) {
      expect(registryEntries(p).length, p).toBeGreaterThanOrEqual(1);
      expect(registryEntries(p).length, p).toBeLessThanOrEqual(4);
    }
  });

  it('gives every entry a name, a description, an official https source and a verification date', () => {
    for (const m of allEntries) {
      expect(m.id.trim(), m.id).not.toBe('');
      expect(m.name.trim(), m.id).not.toBe('');
      expect(m.description.trim(), m.id).not.toBe('');
      expect(m.source, m.id).toMatch(/^https:\/\//);
      expect(m.verifiedOn, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('never repeats an id or a display name', () => {
    const ids = allEntries.map((m) => m.id);
    const names = allEntries.map((m) => m.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps one model family per provider', () => {
    for (const p of REGISTRY_PROVIDERS) {
      for (const m of registryEntries(p)) {
        expect(m.id.startsWith(FAMILY_PREFIX[p]), `${p}: ${m.id}`).toBe(true);
      }
    }
  });

  it('contains none of the retired ids', () => {
    for (const id of RETIRED_IDS) {
      expect(allEntries.some((m) => m.id === id), id).toBe(false);
    }
  });

  it('counts every registered id once', () => {
    expect(REGISTRY_MODEL_COUNT).toBe(allEntries.length);
  });
});

describe('model registry: derived views agree with it', () => {
  it('runtime chain, UI catalogue and display maps all derive from the same ids in the same order', () => {
    for (const p of REGISTRY_PROVIDERS) {
      const ids = registryEntries(p).map((m) => m.id);
      expect(fallbackChains[p]).toEqual(ids);
      expect(PROVIDER_MODELS[p].map((m) => m.id)).toEqual(ids);
      for (const m of registryEntries(p)) {
        expect(specificModelDisplayNames[m.id as keyof typeof specificModelDisplayNames]).toBe(m.name);
        expect(modelDescriptions[m.id as keyof typeof modelDescriptions]).toBe(m.description);
      }
    }
  });

  it('every id the UI can offer is one the runtime calls', () => {
    for (const p of REGISTRY_PROVIDERS) {
      for (const m of PROVIDER_MODELS[p]) {
        expect(fallbackChains[p]).toContain(m.id);
        expect(isRegisteredModel(p, m.id)).toBe(true);
      }
    }
  });

  it('the default is the head of the chain, on every path that asks for it', () => {
    for (const p of REGISTRY_PROVIDERS) {
      expect(defaultModels[p]).toBe(fallbackChains[p][0]);
      expect(getDefaultModel(p)).toBe(fallbackChains[p][0]);
      expect(PROVIDER_MODELS[p][0].default).toBe(true);
      expect(PROVIDER_MODELS[p].filter((m) => m.default)).toHaveLength(1);
    }
  });

  it('display-name lookup returns the real name for a live id and the raw id otherwise', () => {
    expect(getModelDisplayName('cohere', defaultModels.cohere)).toBe(specificModelDisplayNames[defaultModels.cohere]);
    expect(getModelDisplayName('groq', 'mixtral-8x7b-32768')).toBe('mixtral-8x7b-32768');
  });
});

describe('model registry: membership and preference sanitising', () => {
  it('isRegisteredModel accepts a live id under its own provider only', () => {
    expect(isRegisteredModel('gemini', defaultModels.gemini)).toBe(true);
    expect(isRegisteredModel('cohere', defaultModels.gemini)).toBe(false);
    expect(isRegisteredModel('groq', 'llama-3.3-70b-versatile')).toBe(false);
    expect(isRegisteredModel('not-a-provider', defaultModels.cohere)).toBe(false);
    expect(isRegisteredModel('cohere', undefined)).toBe(false);
    expect(isRegisteredModel('cohere', 42)).toBe(false);
  });

  it('sanitizeModelPreferences keeps live ids and drops stale, foreign and junk ones', () => {
    const clean = sanitizeModelPreferences({
      cohere: defaultModels.cohere,
      gemini: 'gemini-2.0-flash',
      groq: 'llama-3.3-70b-versatile',
      openrouter: defaultModels.openrouter,
      toString: 'x',
      custom: 'anything',
    });
    expect(clean).toEqual({ cohere: defaultModels.cohere, openrouter: defaultModels.openrouter });
    expect(sanitizeModelPreferences(null)).toEqual({});
    expect(sanitizeModelPreferences(undefined)).toEqual({});
    expect(sanitizeModelPreferences('nope' as unknown as Record<string, unknown>)).toEqual({});
  });
});

describe('custom-provider presets', () => {
  it('use https base URLs, carry at least one id, and have unique names', () => {
    const names = COMMON_CUSTOM_PROVIDERS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const p of COMMON_CUSTOM_PROVIDERS) {
      expect(p.baseUrl, p.name).toMatch(/^https:\/\//);
      expect(p.models.length, p.name).toBeGreaterThan(0);
    }
  });

  it('contain none of the retired ids', () => {
    for (const p of COMMON_CUSTOM_PROVIDERS) {
      for (const id of p.models) {
        expect(RETIRED_IDS, `${p.name}: ${id}`).not.toContain(id);
      }
    }
  });

  it('include DeepSeek and no longer include Perplexity', () => {
    const names = COMMON_CUSTOM_PROVIDERS.map((p) => p.name);
    expect(names).toContain('DeepSeek');
    expect(names).not.toContain('Perplexity');
  });
});
