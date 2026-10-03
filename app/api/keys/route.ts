import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import ProviderCredential, { BUILTIN_SLOTS } from '@/models/ProviderCredential';
import { KeyVaultNotConfigured } from '@/lib/server/key-vault';
import {
  encryptForSlot,
  publicView,
  validateApiKey,
  type CredentialLike,
  type PublicBuiltinCredential,
  type PublicCustomCredential,
} from '@/lib/server/user-keys';
import type { LLMProvider } from '@/lib/llm/types';

/**
 * Saved built-in provider keys (Batch C, C7).
 *
 * GET    -> { builtin, custom }: masked metadata only, built through publicView.
 * PUT    { provider, apiKey } -> the public view of the saved slot.
 * DELETE ?provider= -> { deleted }.
 *
 * Every handler checks auth() first and validates its input before dbConnect.
 * No provider is called here, so nothing is metered. No response or log line
 * carries a key, ciphertext or user id. Ciphertext (ct/iv/tag, select: false)
 * is never loaded by this route.
 */

// Membership test, a Set and never `in` (see app/api/chat/route.ts): 'toString',
// 'constructor' or '__proto__' must not pass as a provider.
const VALID_PROVIDERS: ReadonlySet<string> = new Set<LLMProvider>(BUILTIN_SLOTS);

function isValidProvider(p: unknown): p is LLMProvider {
  return typeof p === 'string' && VALID_PROVIDERS.has(p);
}

const INVALID_PROVIDER = 'Unknown provider';
const VAULT_NOT_CONFIGURED = 'Key storage is not configured';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(op: string, err: unknown) {
  const name = err instanceof Error ? err.name : 'Error';
  console.error(`[keys] route=keys op=${op} error=${name}`);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    await dbConnect();
    // Default projection: ct/iv/tag are select: false and stay unloaded.
    const docs = (await ProviderCredential.find({ userId })
      .sort({ createdAt: 1 })
      .lean()) as CredentialLike[];

    const builtin: PublicBuiltinCredential[] = [];
    const custom: PublicCustomCredential[] = [];
    for (const doc of docs) {
      let view: PublicBuiltinCredential | PublicCustomCredential;
      try {
        view = publicView(doc);
      } catch {
        // A malformed row is left out rather than failing the whole list.
        continue;
      }
      if (doc.kind === 'builtin') builtin.push(view as PublicBuiltinCredential);
      else custom.push(view as PublicCustomCredential);
    }
    builtin.sort(
      (a, b) => BUILTIN_SLOTS.indexOf(a.provider) - BUILTIN_SLOTS.indexOf(b.provider)
    );
    return NextResponse.json({ builtin, custom });
  } catch (err) {
    return serverError('get', err);
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { provider, apiKey } = body as { provider?: unknown; apiKey?: unknown };
  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: INVALID_PROVIDER }, { status: 400 });
  }
  const keyProblem = validateApiKey(apiKey);
  if (keyProblem !== null) {
    return NextResponse.json({ error: keyProblem }, { status: 400 });
  }

  let fields: ReturnType<typeof encryptForSlot>;
  try {
    fields = encryptForSlot(userId, provider, apiKey as string);
  } catch (err) {
    if (err instanceof KeyVaultNotConfigured) {
      console.error('[keys] vault-not-configured');
      return NextResponse.json({ error: VAULT_NOT_CONFIGURED }, { status: 500 });
    }
    return serverError('put', err);
  }

  try {
    await dbConnect();
    // userId and slot come from the filter; kind and provider only on insert
    // (immutable paths, models/ProviderCredential.ts). A replaced key resets the
    // test state.
    const saved = (await ProviderCredential.findOneAndUpdate(
      { userId, slot: provider },
      {
        $set: {
          ct: fields.ct,
          iv: fields.iv,
          tag: fields.tag,
          keyVersion: fields.keyVersion,
          last4: fields.last4,
          lastTestedAt: null,
          lastTestOk: null,
          lastRejectedAt: null,
        },
        $setOnInsert: { kind: 'builtin', provider },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    ).lean()) as CredentialLike | null;

    // The returned document uses the default projection (no ct/iv/tag); only
    // publicView's named fields leave the route.
    const view = saved
      ? publicView(saved)
      : publicView({ kind: 'builtin', provider, last4: fields.last4 });
    return NextResponse.json(view);
  } catch (err) {
    return serverError('put', err);
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const provider = request.nextUrl.searchParams.get('provider');
  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: INVALID_PROVIDER }, { status: 400 });
  }

  try {
    await dbConnect();
    const result = await ProviderCredential.deleteOne({ userId, slot: provider, kind: 'builtin' });
    return NextResponse.json({ deleted: result.deletedCount > 0 });
  } catch (err) {
    return serverError('delete', err);
  }
}
