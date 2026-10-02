import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkProviderUrl } from '@/lib/security';
import { isAnthropicProvider, normalizeBaseUrl } from '@/lib/llm/models';

// Sends a real test message to a user's custom endpoint (no fetch timeout);
// slow self-hosted models can legitimately take 10-20s.
export const maxDuration = 30;

interface TestCustomProviderRequest {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
}

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
  headerType?: 'bearer' | 'x-api-key'
): Promise<TestConnectionResult> {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const headers = buildHeaders(apiKey, baseUrl, headerType);
  // Wall time of the upstream attempt, reported alongside the status.
  const startedAt = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAt);

  try {
    if (isAnthropicProvider(baseUrl)) {
      // Anthropic API format
      const response = await fetch(`${normalizedUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
          max_tokens: 10,
        }),
        // isPrivateUrl validates only the original URL — never follow redirects.
        redirect: 'manual',
      });
      const meta = { status: response.status, latencyMs: elapsedMs(), model: modelId };

      if (response.status >= 300 && response.status < 400) {
        return { valid: false, error: 'Provider attempted an HTTP redirect — blocked for security.', ...meta };
      }

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
      const response = await fetch(`${normalizedUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
          max_tokens: 10,
        }),
        // isPrivateUrl validates only the original URL — never follow redirects.
        redirect: 'manual',
      });
      const meta = { status: response.status, latencyMs: elapsedMs(), model: modelId };

      if (response.status >= 300 && response.status < 400) {
        return { valid: false, error: 'Provider attempted an HTTP redirect — blocked for security.', ...meta };
      }

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
  } catch (error) {
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as TestCustomProviderRequest;
    const { baseUrl, apiKey, modelId, headerType } = body;

    if (!baseUrl || !apiKey || !modelId) {
      return NextResponse.json(
        { valid: false, error: 'Base URL, API key, and model ID are required' },
        { status: 400 }
      );
    }

    // SSRF protection shared with the chat path (lib/security.ts): https only, no
    // private/internal addresses.
    const urlError = checkProviderUrl(baseUrl);
    if (urlError) {
      return NextResponse.json({ valid: false, error: urlError }, { status: 400 });
    }

    const result = await testConnection(baseUrl, apiKey, modelId, headerType);
    return NextResponse.json(result);
  } catch (error) {
    // Never log the API key in error messages
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
