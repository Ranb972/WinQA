import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  checkProviderUrl,
  resolveProviderAddress,
  safeProviderFetch,
  ProviderRedirectError,
  ProviderUrlError,
  ProviderTimeoutError,
  TEST_PROVIDER_MAX_BODY_BYTES,
  type PinnedAddress,
} from '@/lib/security';
import { isAnthropicProvider, normalizeBaseUrl } from '@/lib/llm/models';
import { consumeProviderTestAllowance, nextUtcMidnightIso } from '@/lib/rate-limit';
// Import-safe on the server: lib/custom-providers touches window/localStorage only
// inside functions.
import { PROVIDER_TEST_LIMIT_ERROR } from '@/lib/custom-providers';
// The chat path's own per-attempt deadline (lib/llm/custom.ts imports the same
// constant). Settings saves a provider only after a passing test, so the test must
// wait exactly as long as the chat will. The module has no imports.
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/provider-timeout';
import dbConnect from '@/lib/mongodb';
import ProviderCredential from '@/models/ProviderCredential';
import { customSlot, loadCustomProvider } from '@/lib/server/user-keys';

// Sends a real test message to a user's custom endpoint. The whole test (resolving
// the host, then the request) shares one DEFAULT_PROVIDER_TIMEOUT_MS budget (20s):
// the request gets whatever the resolution left. The route therefore answers within
// ~20s plus auth and metering, inside maxDuration. A self-hosted model that needs
// more than 20s for a 10-token reply shows "No response in time", as it would time
// out in chat too.
export const maxDuration = 30;

/** Milliseconds of the test budget still unspent, counted from `startedAt` (performance.now()). */
function remainingBudget(startedAt: number): number {
  return DEFAULT_PROVIDER_TIMEOUT_MS - Math.round(performance.now() - startedAt);
}

/**
 * A timeout in either phase is reported against the whole budget ("Request timed
 * out after 20s"), not against the remainder the phase happened to get.
 */
function wholeBudgetTimeout(error: unknown): unknown {
  return error instanceof ProviderTimeoutError ? new ProviderTimeoutError(DEFAULT_PROVIDER_TIMEOUT_MS) : error;
}

/**
 * Either today's typed provider `{ baseUrl, apiKey, modelId, headerType? }`, or a
 * saved one `{ providerId, modelId?, headerType? }` whose base URL and key are
 * loaded on the server (lib/server/user-keys.ts). Never both.
 */
interface TestCustomProviderRequest {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
  providerId?: unknown;
}

const BOTH_FORMS_ERROR = 'Send either providerId or baseUrl and apiKey, not both';
const PROVIDER_NOT_FOUND_ERROR = 'Custom provider not found';
const LOAD_FAILED_ERROR = 'Something went wrong. Please try again.';
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Result of one upstream connection test. `valid`/`error` keep their original
 * meaning; `status`, `latencyMs` and `model` are additive so the UI can show
 * "Connected · {model} · {latency}" or "{reason} · HTTP {status}".
 */
export interface TestConnectionResult {
  valid: boolean;
  error?: string;
  /** Upstream HTTP status when a response arrived; null on network error, timeout or throw. */
  status: number | null;
  /** Wall time of the upstream attempt, in whole milliseconds. */
  latencyMs: number;
  /** The model id that was tested, echoed back. */
  model: string;
}

/**
 * Replace every occurrence of the API key in an outgoing error string with
 * `[key]`, so an upstream body or runtime error that echoes the key never
 * reaches the client. Keys under 8 chars are left alone (too likely to match
 * ordinary text). Output hardening only; no check depends on it.
 */
function redactKey(text: string, apiKey: string): string {
  if (typeof text !== 'string' || typeof apiKey !== 'string' || apiKey.length < 8) {
    return text;
  }
  return text.split(apiKey).join('[key]');
}

/** A hung test leaves a runtime-log line shaped like the engine's timeout line. */
function logTimeout(modelId: string, error: unknown): void {
  if (error instanceof ProviderTimeoutError) {
    console.error(`[llm] custom-test ${modelId} ${error.message.replace(/^Request /, '')} key=user`);
  }
}

/**
 * Build headers for the API request
 */
function buildHeaders(
  apiKey: string,
  baseUrl: string,
  headerType?: 'bearer' | 'x-api-key'
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const useXApiKey = headerType === 'x-api-key' || isAnthropicProvider(baseUrl);

  if (useXApiKey) {
    headers['x-api-key'] = apiKey;
    if (isAnthropicProvider(baseUrl)) {
      headers['anthropic-version'] = '2023-06-01';
    }
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * Test connection to a custom provider
 */
async function testConnection(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  headerType: 'bearer' | 'x-api-key' | undefined,
  pinned: PinnedAddress,
  timeoutMs: number
): Promise<TestConnectionResult> {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const headers = buildHeaders(apiKey, baseUrl, headerType);
  // Wall time of the upstream attempt, reported alongside the status.
  const startedAt = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAt);

  try {
    if (isAnthropicProvider(baseUrl)) {
      // Anthropic API format
      // Connects only to the vetted address; a 3xx throws (handled below).
      const response = await safeProviderFetch(`${normalizedUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
          max_tokens: 10,
        }),
        pinned,
        timeoutMs,
        // 64 KiB: over it the result carries PROVIDER_BODY_TOO_LARGE_ERROR, status null.
        maxBodyBytes: TEST_PROVIDER_MAX_BODY_BYTES,
      });
      const meta = { status: response.status, latencyMs: elapsedMs(), model: modelId };

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid API key', ...meta };
      }

      if (response.status === 429) {
        return { valid: true, ...meta }; // Rate limited but key is valid
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: redactKey(data.error?.message || `HTTP ${response.status}: ${response.statusText}`, apiKey),
          ...meta,
        };
      }

      return { valid: true, ...meta };
    } else {
      // OpenAI-compatible API format
      // Connects only to the vetted address; a 3xx throws (handled below).
      const response = await safeProviderFetch(`${normalizedUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
          max_tokens: 10,
        }),
        pinned,
        timeoutMs,
        // 64 KiB: over it the result carries PROVIDER_BODY_TOO_LARGE_ERROR, status null.
        maxBodyBytes: TEST_PROVIDER_MAX_BODY_BYTES,
      });
      const meta = { status: response.status, latencyMs: elapsedMs(), model: modelId };

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid API key', ...meta };
      }

      if (response.status === 429) {
        return { valid: true, ...meta }; // Rate limited but key is valid
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: redactKey(data.error?.message || `HTTP ${response.status}: ${response.statusText}`, apiKey),
          ...meta,
        };
      }

      return { valid: true, ...meta };
    }
  } catch (caught) {
    const error = wholeBudgetTimeout(caught);
    if (error instanceof ProviderRedirectError) {
      // Never followed: a public host could 302 the server into a private address.
      return {
        valid: false,
        error: 'Provider attempted an HTTP redirect — blocked for security.',
        status: error.status,
        latencyMs: elapsedMs(),
        model: modelId,
      };
    }
    logTimeout(modelId, error);
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      valid: false,
      error: redactKey(message, apiKey),
      status: null,
      latencyMs: elapsedMs(),
      model: modelId,
    };
  }
}

/** The fields one connection test runs on, from the body or from the saved record. */
interface TestInput {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
}

/**
 * The one test pipeline, for a typed provider and a saved one alike: required
 * fields, the URL checks (length, https, private literal), the DNS vetting, the
 * metering, then the request on what is left of the shared budget. `outcome` is
 * set when a TestConnectionResult was produced (the provider was tried, or its
 * name did not resolve in time), and absent for a 400 or the 429 limit.
 */
async function runTest(
  userId: string,
  { baseUrl, apiKey, modelId, headerType }: TestInput
): Promise<{ response: NextResponse; outcome?: boolean }> {
  if (!baseUrl || !apiKey || !modelId) {
    return {
      response: NextResponse.json(
        { valid: false, error: 'Base URL, API key, and model ID are required' },
        { status: 400 }
      ),
    };
  }

  // SSRF protection shared with the chat path (lib/security.ts): https only, no
  // private/internal addresses.
  const urlError = checkProviderUrl(baseUrl);
  if (urlError) {
    return { response: NextResponse.json({ valid: false, error: urlError }, { status: 400 }) };
  }

  // One budget for the whole test: the clock starts before the resolution, and the
  // request gets only what is left of DEFAULT_PROVIDER_TIMEOUT_MS.
  const budgetStartedAt = performance.now();

  // Resolve the host once and vet every answer; the test request then connects
  // to that address only (lib/security.ts safeProviderFetch).
  let pinned: PinnedAddress;
  try {
    pinned = await resolveProviderAddress(baseUrl, DEFAULT_PROVIDER_TIMEOUT_MS);
  } catch (caught) {
    const error = wholeBudgetTimeout(caught);
    if (error instanceof ProviderUrlError) {
      return { response: NextResponse.json({ valid: false, error: error.message }, { status: 400 }) };
    }
    // The name did not resolve (or not in time): report it like any unreachable provider.
    logTimeout(modelId, error);
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      response: NextResponse.json({
        valid: false,
        error: redactKey(message, apiKey),
        status: null,
        latencyMs: 0,
        model: modelId,
      } satisfies TestConnectionResult),
      outcome: false,
    };
  }

  // Metered only once every guard has passed, so a rejected request costs
  // nothing; counted apart from the LLM allowance (lib/rate-limit.ts).
  const { allowed } = await consumeProviderTestAllowance(userId);
  if (!allowed) {
    return {
      response: NextResponse.json(
        {
          valid: false,
          error: PROVIDER_TEST_LIMIT_ERROR,
          status: 429,
          latencyMs: 0,
          model: modelId,
          resetsAt: nextUtcMidnightIso(),
        },
        { status: 429 }
      ),
    };
  }

  // The resolution (and the metering write) may have used up the budget; then
  // there is no time left to ask the provider anything.
  const requestBudgetMs = remainingBudget(budgetStartedAt);
  if (requestBudgetMs <= 0) {
    const timeout = new ProviderTimeoutError(DEFAULT_PROVIDER_TIMEOUT_MS);
    logTimeout(modelId, timeout);
    return {
      response: NextResponse.json({
        valid: false,
        error: timeout.message,
        status: null,
        latencyMs: 0,
        model: modelId,
      } satisfies TestConnectionResult),
      outcome: false,
    };
  }

  const result = await testConnection(baseUrl, apiKey, modelId, headerType, pinned, requestBudgetMs);
  return { response: NextResponse.json(result), outcome: result.valid };
}

/**
 * Records the outcome on the saved record. Fire-and-forget: the answer never
 * waits for it, and a failure logs only the slot and the error class. Only
 * lastTestedAt and lastTestOk are set; never userId, slot or kind.
 */
function recordTestResult(userId: string, slot: string, ok: boolean): void {
  void (async () => {
    try {
      await dbConnect();
      await ProviderCredential.updateOne(
        { userId, slot, kind: 'custom' },
        { $set: { lastTestedAt: new Date(), lastTestOk: ok } },
        { runValidators: true }
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      console.error(`[keys] record-test-failed slot=${slot} error=${name}`);
    }
  })();
}

const hasField = (body: object, field: string): boolean => Object.prototype.hasOwnProperty.call(body, field);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as TestCustomProviderRequest;

    if (typeof body === 'object' && body !== null && hasField(body, 'providerId')) {
      // A saved provider: its key goes only to its own saved base URL, so a body
      // that also names a base URL or a key is refused before any DB or network call.
      if (hasField(body, 'baseUrl') || hasField(body, 'apiKey')) {
        return NextResponse.json({ valid: false, error: BOTH_FORMS_ERROR }, { status: 400 });
      }
      const { providerId } = body;
      if (typeof providerId !== 'string' || !OBJECT_ID_RE.test(providerId)) {
        return NextResponse.json({ valid: false, error: PROVIDER_NOT_FOUND_ERROR }, { status: 404 });
      }
      const id = providerId.toLowerCase();
      // null for not found, not this user's, or not decryptable (the loader logs
      // the decrypt failure); the client sees the same 404 for all three.
      let saved: Awaited<ReturnType<typeof loadCustomProvider>>;
      try {
        saved = await loadCustomProvider(userId, id);
      } catch (err) {
        // A DB error message can name the cluster host; only its class is logged
        // and the client gets the generic text.
        const name = err instanceof Error ? err.name : 'Error';
        console.error(`[keys] load-failed error=${name}`);
        return NextResponse.json({ valid: false, error: LOAD_FAILED_ERROR }, { status: 500 });
      }
      if (!saved) {
        return NextResponse.json({ valid: false, error: PROVIDER_NOT_FOUND_ERROR }, { status: 404 });
      }
      // Overridable from the body, then checked exactly as a typed provider's.
      const modelId = body.modelId !== undefined ? body.modelId : saved.modelId;
      const headerType = body.headerType !== undefined ? body.headerType : saved.headerType;
      const { response, outcome } = await runTest(userId, {
        baseUrl: saved.baseUrl,
        apiKey: saved.apiKey,
        modelId,
        headerType,
      });
      // A trial of another model or header says nothing about the saved
      // configuration, so only a test of the saved one is recorded.
      const testedAsSaved = modelId === saved.modelId && headerType === saved.headerType;
      if (outcome !== undefined && testedAsSaved) recordTestResult(userId, customSlot(id), outcome);
      return response;
    }

    const { baseUrl, apiKey, modelId, headerType } = body;
    const { response } = await runTest(userId, { baseUrl, apiKey, modelId, headerType });
    return response;
  } catch (error) {
    // Never log the API key in error messages
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
