import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ProviderCredential from '@/models/ProviderCredential';
import { KeyVaultNotConfigured } from '@/lib/server/key-vault';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { customSlot, encryptForSlot, publicView, validateApiKey } from '@/lib/server/user-keys';
import {
  BASE_URL_NEEDS_KEY_ERROR,
  checkBaseUrl,
  checkEnabled,
  checkHeaderType,
  checkModelId,
  checkName,
  KEY_STORAGE_ERROR,
  logRouteError,
  parseProviderId,
  readJsonObject,
} from '../fields';

const NOT_FOUND = { error: 'Custom provider not found' } as const;

/**
 * PATCH /api/custom-providers/[id]: change any subset of
 * `{ name, baseUrl, modelId, headerType, enabled, apiKey }` on one of the user's
 * custom providers.
 *
 * - The id must be 24 hex characters (lower-cased); anything else is a 404 with
 *   no DB call.
 * - D20: a `baseUrl` without an `apiKey` is a 400, so a stored key is never sent
 *   to a host it was not saved for. The check does not compare with the stored
 *   URL; the client sends baseUrl only when it changed.
 * - A new key is encrypted under this document's slot and resets the test and
 *   rejection fields.
 * - Only the fields sent are $set; userId, slot, kind and provider never are.
 *   A new baseUrl without a headerType $unsets the stored headerType.
 *   The filter carries userId and kind, so another user's id is a 404.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseProviderId((await params).id);
    if (!id) return NextResponse.json(NOT_FOUND, { status: 404 });

    const parsed = await readJsonObject(request, BODY_LIMITS.customProviders);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const body = parsed.value;

    if (body.baseUrl !== undefined && body.apiKey === undefined) {
      return NextResponse.json({ error: BASE_URL_NEEDS_KEY_ERROR }, { status: 400 });
    }

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (body.name !== undefined) {
      const name = checkName(body.name);
      if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
      $set.name = name.value;
    }
    if (body.modelId !== undefined) {
      const modelId = checkModelId(body.modelId);
      if (!modelId.ok) return NextResponse.json({ error: modelId.error }, { status: 400 });
      $set.modelId = modelId.value;
    }
    if (body.headerType !== undefined) {
      const headerType = checkHeaderType(body.headerType);
      if (!headerType.ok) return NextResponse.json({ error: headerType.error }, { status: 400 });
      $set.headerType = headerType.value;
    }
    if (body.enabled !== undefined) {
      const enabled = checkEnabled(body.enabled);
      if (!enabled.ok) return NextResponse.json({ error: enabled.error }, { status: 400 });
      $set.enabled = enabled.value;
    }
    let apiKey: string | undefined;
    if (body.apiKey !== undefined) {
      const keyError = validateApiKey(body.apiKey);
      if (keyError) return NextResponse.json({ error: keyError }, { status: 400 });
      apiKey = body.apiKey as string;
    }
    // Last check before the database: it may wait on DNS.
    if (body.baseUrl !== undefined) {
      const baseUrl = await checkBaseUrl(body.baseUrl);
      if (!baseUrl.ok) return NextResponse.json({ error: baseUrl.error }, { status: 400 });
      $set.baseUrl = baseUrl.value;
      // A header type chosen for the old host must not override the engine's
      // auto-detection for the new one (lib/llm/custom.ts falls back to
      // getHeaderType(baseUrl) only when headerType is unset).
      if (body.headerType === undefined) $unset.headerType = 1;
    }

    if (apiKey === undefined && Object.keys($set).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    if (apiKey !== undefined) {
      // The AAD names this user and this document's slot, so the record cannot
      // be moved to another row.
      const encrypted = encryptForSlot(userId, customSlot(id), apiKey);
      $set.ct = encrypted.ct;
      $set.iv = encrypted.iv;
      $set.tag = encrypted.tag;
      $set.keyVersion = encrypted.keyVersion;
      $set.last4 = encrypted.last4;
      // The old key's test and rejection results say nothing about the new one.
      $set.lastTestedAt = null;
      $set.lastTestOk = null;
      $set.lastRejectedAt = null;
    }

    await dbConnect();
    const updated = await ProviderCredential.findOneAndUpdate(
      { _id: id, userId, kind: 'custom' },
      Object.keys($unset).length > 0 ? { $set, $unset } : { $set },
      // returnDocument: 'after' is Mongoose 9's spelling of the deprecated new: true.
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return NextResponse.json(NOT_FOUND, { status: 404 });

    return NextResponse.json(publicView(updated));
  } catch (error) {
    if (error instanceof KeyVaultNotConfigured) {
      console.error('[keys] vault-not-configured');
      return NextResponse.json({ error: KEY_STORAGE_ERROR }, { status: 500 });
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: 'Invalid custom provider' }, { status: 400 });
    }
    logRouteError('update', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/custom-providers/[id]: removes one of the user's custom providers.
 * Same id rule as PATCH. 200 `{ deleted }`; false when no such provider is the
 * user's.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseProviderId((await params).id);
    if (!id) return NextResponse.json(NOT_FOUND, { status: 404 });

    await dbConnect();
    const result = await ProviderCredential.deleteOne({ _id: id, userId, kind: 'custom' });
    return NextResponse.json({ deleted: result.deletedCount === 1 });
  } catch (error) {
    logRouteError('delete', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
