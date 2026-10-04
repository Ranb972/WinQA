import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ProviderCredential, { type CredentialHeaderType } from '@/models/ProviderCredential';
import { KeyVaultNotConfigured } from '@/lib/server/key-vault';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import {
  encryptForSlot,
  newCustomCredentialId,
  publicView,
  validateApiKey,
} from '@/lib/server/user-keys';
// Import-safe on the server: lib/custom-providers touches window/localStorage only
// inside functions.
import { MAX_CUSTOM_PROVIDERS } from '@/lib/custom-providers';
import {
  checkBaseUrl,
  checkEnabled,
  checkHeaderType,
  checkModelId,
  checkName,
  KEY_STORAGE_ERROR,
  logRouteError,
  readJsonObject,
} from './fields';

/**
 * POST /api/custom-providers: save one custom provider as its own document.
 *
 * Body `{ name, baseUrl, modelId, headerType?, enabled, apiKey }`. Every field is
 * checked and the base URL passes the S2/S3/S4 guards before the database is
 * touched. The key is encrypted under the new document's slot and never returned:
 * the response is publicView() of the created document (201). Not metered.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await readJsonObject(request, BODY_LIMITS.customProviders);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const body = parsed.value;

    const name = checkName(body.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
    const modelId = checkModelId(body.modelId);
    if (!modelId.ok) return NextResponse.json({ error: modelId.error }, { status: 400 });
    // headerType is optional, as in the client's CustomProvider: without it the
    // engine picks the header from the base URL.
    let headerType: CredentialHeaderType | undefined;
    if (body.headerType !== undefined) {
      const checked = checkHeaderType(body.headerType);
      if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
      headerType = checked.value;
    }
    // Required and stored as sent: there is no default.
    const enabled = checkEnabled(body.enabled);
    if (!enabled.ok) return NextResponse.json({ error: enabled.error }, { status: 400 });
    const keyError = validateApiKey(body.apiKey);
    if (keyError) return NextResponse.json({ error: keyError }, { status: 400 });
    const apiKey = body.apiKey as string;

    // Last check before the database: it may wait on DNS.
    const baseUrl = await checkBaseUrl(body.baseUrl);
    if (!baseUrl.ok) return NextResponse.json({ error: baseUrl.error }, { status: 400 });

    await dbConnect();

    // Count, then insert. Two concurrent POSTs from one user can both see 5 and
    // both insert, leaving 7 rows. Accepted: the cap bounds storage per user and
    // is not a security boundary, and one extra row is harmless.
    const count = await ProviderCredential.countDocuments({ userId, kind: 'custom' });
    if (count >= MAX_CUSTOM_PROVIDERS) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_CUSTOM_PROVIDERS} custom providers` },
        { status: 400 }
      );
    }

    // _id and slot are written together, so slot === `custom:<_id>` from the
    // first write and the key's AAD names this document.
    const { _id, slot } = newCustomCredentialId();
    const encrypted = encryptForSlot(userId, slot, apiKey);

    const created = await ProviderCredential.create({
      _id,
      userId,
      slot,
      kind: 'custom',
      name: name.value,
      baseUrl: baseUrl.value,
      modelId: modelId.value,
      ...(headerType ? { headerType } : {}),
      enabled: enabled.value,
      ct: encrypted.ct,
      iv: encrypted.iv,
      tag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      last4: encrypted.last4,
    });

    return NextResponse.json(publicView(created), { status: 201 });
  } catch (error) {
    if (error instanceof KeyVaultNotConfigured) {
      console.error('[keys] vault-not-configured');
      return NextResponse.json({ error: KEY_STORAGE_ERROR }, { status: 500 });
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: 'Invalid custom provider' }, { status: 400 });
    }
    logRouteError('create', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
