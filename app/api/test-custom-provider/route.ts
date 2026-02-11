import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isPrivateUrl } from '@/lib/security';

interface TestCustomProviderRequest {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headerType?: 'bearer' | 'x-api-key';
}

interface TestCustomProviderResponse {
  valid: boolean;
  error?: string;
}

/**
 * Detect if a provider uses Anthropic API format based on base URL
 */
function isAnthropicProvider(baseUrl: string): boolean {
  const normalized = baseUrl.toLowerCase().replace(/\/+$/, '');
  return normalized.includes('anthropic.com');
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
): Promise<TestCustomProviderResponse> {
  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  const headers = buildHeaders(apiKey, baseUrl, headerType);

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
      });

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid API key' };
      }

      if (response.status === 429) {
        return { valid: true }; // Rate limited but key is valid
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: data.error?.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { valid: true };
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
      });

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid API key' };
      }

      if (response.status === 429) {
        return { valid: true }; // Rate limited but key is valid
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: data.error?.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { valid: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return { valid: false, error: message };
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

    // SSRF protection: require https and block private IPs
    if (!baseUrl.startsWith('https://')) {
      return NextResponse.json(
        { valid: false, error: 'Base URL must use HTTPS' },
        { status: 400 }
      );
    }

    if (isPrivateUrl(baseUrl)) {
      return NextResponse.json(
        { valid: false, error: 'Base URL must not point to a private/internal address' },
        { status: 400 }
      );
    }

    const result = await testConnection(baseUrl, apiKey, modelId, headerType);
    return NextResponse.json(result);
  } catch (error) {
    // Never log the API key in error messages
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
