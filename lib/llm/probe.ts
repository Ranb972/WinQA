import { chat } from './index';
import type { ChatMessage, LLMProvider } from './types';
import { REGISTRY_PROVIDERS, defaultModels } from './registry';

// The first piece of the model radar (Batch E3.1, item 6). Once a day the
// keep-alive cron sends one one-token message per provider on the app's own key
// and logs what came back, so a bad production key shows up in the runtime logs
// within a day of a deploy instead of in the next smoke. On 2026-09-09 production
// rejected MISTRAL_API_KEY on every call and nothing had probed it.

/** Cap per probe. An auth answer takes well under a second; slower is "timeout". */
export const PROBE_TIMEOUT_MS = 10000;

/** ok, the HTTP status the adapter reported, or the two non-HTTP outcomes. */
export type ProbeStatus = 'ok' | 'timeout' | 'error' | number;

export interface ProbeResult {
  provider: LLMProvider;
  model: string;
  status: ProbeStatus;
  ms: number;
}

const PROBE_MESSAGES: ChatMessage[] = [{ role: 'user', content: 'Hi' }];

/** The status of an adapter error string: its leading HTTP status, else timeout or error. */
export function probeStatus(error: string | undefined): ProbeStatus {
  if (!error) return 'ok';
  const m = /^(\d{3})\b/.exec(error);
  if (m) return Number(m[1]);
  if (/timed out/i.test(error)) return 'timeout';
  return 'error';
}

/** The one line per provider the radar reads: fixed field order, no free text. */
export function formatProbeLine(result: ProbeResult): string {
  return `[probe] provider=${result.provider} status=${result.status} model=${result.model} ms=${result.ms}`;
}

/**
 * Probe one provider on the app key: the chain head, one attempt, no fallback,
 * one output token. The adapters still write their own "[llm] ... key=app" line
 * on a failure. Never throws.
 */
export async function probeProvider(provider: LLMProvider): Promise<ProbeResult> {
  const model = defaultModels[provider];
  const started = Date.now();
  try {
    const response = await chat(PROBE_MESSAGES, provider, 0, 1, true, undefined, undefined, {
      enableCrossProviderFallback: false,
      maxAttempts: 1,
      providerTimeout: PROBE_TIMEOUT_MS,
    });
    return {
      provider,
      model: response.specificModel || model,
      status: probeStatus(response.error),
      ms: Date.now() - started,
    };
  } catch {
    return { provider, model, status: 'error', ms: Date.now() - started };
  }
}

/** Probe every built-in provider in parallel and log one line each. */
export async function probeAppKeys(): Promise<ProbeResult[]> {
  const results = await Promise.all(REGISTRY_PROVIDERS.map((provider) => probeProvider(provider)));
  for (const result of results) {
    const line = formatProbeLine(result);
    if (result.status === 'ok') console.log(line);
    else console.error(line);
  }
  return results;
}
