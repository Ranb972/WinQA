import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ProviderCredential, {
  BUILTIN_SLOTS,
  type CredentialHeaderType,
} from '@/models/ProviderCredential';
import { KeyVaultNotConfigured } from '@/lib/server/key-vault';
import {
  encryptForSlot,
  newCustomCredentialId,
  publicView,
  validateApiKey,
  type EncryptedCredentialFields,
  type PublicCustomCredential,
} from '@/lib/server/user-keys';
import {
  checkProviderUrl,
  resolveProviderAddress,
  ProviderUrlError,
  UNREACHABLE_PROVIDER_ERROR,
} from '@/lib/security';
import { normalizeBaseUrl } from '@/lib/llm/models';
import { DEFAULT_PROVIDER_TIMEOUT_MS } from '@/lib/llm/provider-timeout';
// Import-safe on the server: lib/custom-providers touches window/localStorage only
// inside functions.
import { MAX_CUSTOM_PROVIDERS } from '@/lib/custom-providers';
import {
  checkEnabled,
  checkHeaderType,
  checkModelId,
  checkName,
  KEY_STORAGE_ERROR,
  readJsonObject,
} from '@/app/api/custom-providers/fields';
import type { LLMProvider } from '@/lib/llm/types';

/**
 * POST /api/keys/migrate: one-time upload of the keys a browser still holds
 * (Batch C, C14).
 *
 * Body `{ builtin?: { [provider]: apiKey }, custom?: [{ name, baseUrl, modelId,
 * headerType?, enabled, apiKey }] }`. Response 200 `{ moved: { builtin, custom },
 * skipped: [{ item, reason }] }`.
 *
 * Every entry gets the checks of the single-item routes (PUT /api/keys, POST
 * /api/custom-providers): auth first, every field and every base URL guard
 * before dbConnect, the key encrypted under the user's AAD for its slot. A bad
 * entry is skipped with a reason; it never fails the others.
 * - Built-in: the server wins. A slot that already holds a key is skipped;
 *   otherwise the same upsert as PUT /api/keys.
 * - Custom: de-duplicated within the request and against the saved rows on
 *   (normalized baseUrl, modelId, name), then inserted one by one up to
 *   MAX_CUSTOM_PROVIDERS in total, each like POST /api/custom-providers.
 *   `enabled` is kept as sent.
 * - `item` is a built-in provider id or a custom provider's name (or
 *   `custom provider <n>` when the name itself is invalid), never a key or a
 *   base URL. moved.custom holds publicView() of each created row only. No
 *   response or log line carries a key, ciphertext or user id.
 *
 * Not metered: no provider is called.
 */

// DNS budget. Up to MAX_CUSTOM_ENTRIES base URLs are vetted, DNS_CONCURRENCY at
// a time, each within DNS_TIMEOUT_MS. Worst case ceil(20 / 5) * 5 s = 20 s, the
// shared DEFAULT_PROVIDER_TIMEOUT_MS budget, which leaves ~10 s of the 30 s
// maxDuration for auth, encryption and at most 2 reads + 4 upserts + 6 inserts.
// A healthy resolver answers in well under a second. A host that needs more than
// 5 s is skipped with the unreachable text and can still be added by hand in
// Settings, where POST /api/custom-providers gives one URL the full 20 s.
export const maxDuration = 30;
const MAX_CUSTOM_ENTRIES = 20;
const DNS_CONCURRENCY = 5;
const DNS_TIMEOUT_MS = Math.min(5000, DEFAULT_PROVIDER_TIMEOUT_MS);

const VALID_PROVIDERS: ReadonlySet<string> = new Set<LLMProvider>(BUILTIN_SLOTS);
// An unknown provider name is echoed only when it looks like a provider id, so a
// key pasted as a property name never comes back.
const ECHOABLE_PROVIDER_RE = /^[a-z][a-z0-9-]{0,19}$/;

const REASON_UNKNOWN_PROVIDER = 'Unknown provider';
const REASON_BUILTIN_EXISTS = 'A key is already saved for this provider';
const REASON_ALREADY_SAVED = 'Already saved';
const REASON_DUPLICATE = 'Duplicate in this request';
const REASON_INVALID_ENTRY = 'Invalid custom provider';
const REASON_CAP = `You can save up to ${MAX_CUSTOM_PROVIDERS} custom providers`;
const REASON_SAVE_FAILED = 'Could not save';

interface Skipped {
  item: string;
  reason: string;
}

interface CustomCandidate {
  item: string;
  name: string;
  modelId: string;
  headerType?: CredentialHeaderType;
  enabled: boolean;
  apiKey: string;
  /** Normalized (normalizeBaseUrl): what is vetted, compared and stored. */
  baseUrl: string;
}

type CustomReady = CustomCandidate & {
  _id: mongoose.Types.ObjectId;
  slot: string;
  fields: EncryptedCredentialFields;
};

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function somethingWentWrong() {
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

/** `[keys] route=migrate op=<op> error=<class>`: never a user id, key or ciphertext. */
function logError(op: string, err: unknown): void {
  const name = err instanceof Error ? err.name : 'Error';
  console.error(`[keys] route=migrate op=${op} error=${name}`);
}

/** The de-duplication identity of a custom provider: (normalized baseUrl, modelId, name). */
function dedupKey(baseUrl: string, modelId: string, name: string): string {
  return JSON.stringify([normalizeBaseUrl(baseUrl), modelId, name]);
}

/**
 * The DNS step of fields.ts checkBaseUrl (same error texts), with the per-entry
 * DNS_TIMEOUT_MS budget instead of the full 20 s. null when the host passes.
 */
async function vetHost(normalized: string): Promise<string | null> {
  try {
    await resolveProviderAddress(normalized, DNS_TIMEOUT_MS);
    return null;
  } catch (error) {
    return error instanceof ProviderUrlError ? error.message : UNREACHABLE_PROVIDER_ERROR;
  }
}

/** Runs `work` over `items`, at most `limit` at a time; results keep the input order. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { builtin: rawBuiltin, custom: rawCustom } = parsed.value;

  if (
    rawBuiltin !== undefined &&
    (rawBuiltin === null || typeof rawBuiltin !== 'object' || Array.isArray(rawBuiltin))
  ) {
    return badRequest('builtin must be an object');
  }
  if (rawCustom !== undefined && !Array.isArray(rawCustom)) {
    return badRequest('custom must be an array');
  }
  // Own enumerable properties only (a JSON '__proto__' key is one, and is then
  // refused by the Set check like any unknown provider).
  const builtinEntries = rawBuiltin ? Object.entries(rawBuiltin as Record<string, unknown>) : [];
  const customEntries: unknown[] = rawCustom ?? [];
  if (builtinEntries.length > BUILTIN_SLOTS.length) {
    return badRequest('Too many built-in keys in one request');
  }
  if (customEntries.length > MAX_CUSTOM_ENTRIES) {
    return badRequest('Too many custom providers in one request');
  }

  const skipped: Skipped[] = [];

  // Built-in entries: the checks of PUT /api/keys.
  const builtinValid: Array<{ provider: LLMProvider; apiKey: string }> = [];
  for (const [provider, apiKey] of builtinEntries) {
    if (!VALID_PROVIDERS.has(provider)) {
      skipped.push({
        item: ECHOABLE_PROVIDER_RE.test(provider) ? provider : 'unknown provider',
        reason: REASON_UNKNOWN_PROVIDER,
      });
      continue;
    }
    const keyProblem = validateApiKey(apiKey);
    if (keyProblem !== null) {
      skipped.push({ item: provider, reason: keyProblem });
      continue;
    }
    builtinValid.push({ provider: provider as LLMProvider, apiKey: apiKey as string });
  }

  // Custom entries: the field checks of POST /api/custom-providers, in its order,
  // then the URL guards up to the literal check, then de-duplication within the
  // request (first one wins) so a duplicate costs no DNS lookup.
  const seen = new Set<string>();
  const fieldsOk: CustomCandidate[] = [];
  customEntries.forEach((entry, index) => {
    const fallbackItem = `custom provider ${index + 1}`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      skipped.push({ item: fallbackItem, reason: REASON_INVALID_ENTRY });
      return;
    }
    const e = entry as Record<string, unknown>;
    const name = checkName(e.name);
    if (!name.ok) {
      skipped.push({ item: fallbackItem, reason: name.error });
      return;
    }
    const item = name.value;
    const modelId = checkModelId(e.modelId);
    if (!modelId.ok) {
      skipped.push({ item, reason: modelId.error });
      return;
    }
    let headerType: CredentialHeaderType | undefined;
    if (e.headerType !== undefined) {
      const checked = checkHeaderType(e.headerType);
      if (!checked.ok) {
        skipped.push({ item, reason: checked.error });
        return;
      }
      headerType = checked.value;
    }
    const enabled = checkEnabled(e.enabled);
    if (!enabled.ok) {
      skipped.push({ item, reason: enabled.error });
      return;
    }
    const keyProblem = validateApiKey(e.apiKey);
    if (keyProblem !== null) {
      skipped.push({ item, reason: keyProblem });
      return;
    }
    if (typeof e.baseUrl !== 'string') {
      // checkProviderUrl gives the HTTPS message for anything that is not a string.
      skipped.push({ item, reason: checkProviderUrl(e.baseUrl) ?? UNREACHABLE_PROVIDER_ERROR });
      return;
    }
    const baseUrl = normalizeBaseUrl(e.baseUrl);
    const urlError = checkProviderUrl(baseUrl);
    if (urlError) {
      skipped.push({ item, reason: urlError });
      return;
    }
    const key = dedupKey(baseUrl, modelId.value, name.value);
    if (seen.has(key)) {
      // Not 'Already saved': the first copy may still fail DNS or the cap.
      skipped.push({ item, reason: REASON_DUPLICATE });
      return;
    }
    seen.add(key);
    fieldsOk.push({
      item,
      name: name.value,
      modelId: modelId.value,
      ...(headerType ? { headerType } : {}),
      enabled: enabled.value,
      apiKey: e.apiKey as string,
      baseUrl,
    });
  });

  // DNS vetting, the last check before the database (budget note at the top).
  const dnsErrors = await mapLimited(fieldsOk, DNS_CONCURRENCY, (c) => vetHost(c.baseUrl));
  const customValid: CustomCandidate[] = [];
  fieldsOk.forEach((c, i) => {
    const dnsError = dnsErrors[i];
    if (dnsError !== null) skipped.push({ item: c.item, reason: dnsError });
    else customValid.push(c);
  });

  const moved: { builtin: LLMProvider[]; custom: PublicCustomCredential[] } = {
    builtin: [],
    custom: [],
  };
  const respond = () => {
    console.log(
      `[keys] route=migrate moved=${moved.builtin.length + moved.custom.length} skipped=${skipped.length}`
    );
    return NextResponse.json({ moved, skipped });
  };

  if (builtinValid.length === 0 && customValid.length === 0) return respond();

  // Encrypt everything before the first database call, so a missing key ring is
  // a 500 with nothing written. Custom ids are drawn here (slot === custom:<_id>
  // from the first write, as in POST); an id whose entry is later skipped is
  // simply discarded.
  let builtinReady: Array<{ provider: LLMProvider; fields: EncryptedCredentialFields }>;
  let customReady: CustomReady[];
  try {
    builtinReady = builtinValid.map(({ provider, apiKey }) => ({
      provider,
      fields: encryptForSlot(userId, provider, apiKey),
    }));
    customReady = customValid.map((c) => {
      const { _id, slot } = newCustomCredentialId();
      return { ...c, _id, slot, fields: encryptForSlot(userId, slot, c.apiKey) };
    });
  } catch (err) {
    if (err instanceof KeyVaultNotConfigured) {
      console.error('[keys] vault-not-configured');
      return NextResponse.json({ error: KEY_STORAGE_ERROR }, { status: 500 });
    }
    logError('encrypt', err);
    return somethingWentWrong();
  }

  // Both reads before any write: a failure here is a 500 with nothing written.
  let savedBuiltin: Set<string>;
  let savedCustom: Set<string>;
  let customCount = 0;
  try {
    await dbConnect();
    // Default projection: ct/iv/tag are select: false and stay unloaded.
    const rows = (await ProviderCredential.find({ userId }).lean()) as Array<{
      kind?: unknown;
      slot?: unknown;
      name?: unknown;
      baseUrl?: unknown;
      modelId?: unknown;
    }>;
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    savedBuiltin = new Set(
      rows.filter((r) => r.kind === 'builtin').map((r) => text(r.slot))
    );
    savedCustom = new Set(
      rows
        .filter((r) => r.kind === 'custom')
        .map((r) => dedupKey(text(r.baseUrl), text(r.modelId), text(r.name)))
    );
    if (customReady.length > 0) {
      customCount = await ProviderCredential.countDocuments({ userId, kind: 'custom' });
    }
  } catch (err) {
    logError('read', err);
    return somethingWentWrong();
  }

  // Built-in: the server wins for a slot that already holds a key. Otherwise the
  // upsert of PUT /api/keys: userId and slot from the filter, kind and provider
  // only on insert (immutable paths), runValidators. Server-wins is a
  // read-then-upsert, not atomic: a key saved from another tab in the
  // milliseconds between the read above and this write is overwritten by the
  // browser's key, which breaks server-wins for that slot. Accepted for now; the
  // follow-up is an atomic upsert with everything in $setOnInsert and
  // includeResultMetadata, reporting the slot as skipped when nothing was inserted.
  for (const { provider, fields } of builtinReady) {
    if (savedBuiltin.has(provider)) {
      skipped.push({ item: provider, reason: REASON_BUILTIN_EXISTS });
      continue;
    }
    try {
      await ProviderCredential.findOneAndUpdate(
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
      ).lean();
      moved.builtin.push(provider);
    } catch (err) {
      logError('upsert', err);
      skipped.push({ item: provider, reason: REASON_SAVE_FAILED });
    }
  }

  // Custom: against the saved rows first, then the cap. Count, then insert one by
  // one; as in POST /api/custom-providers, a concurrent create can take the total
  // one past the cap (accepted: the cap bounds storage, not a security boundary).
  let room = Math.max(0, MAX_CUSTOM_PROVIDERS - customCount);
  for (const c of customReady) {
    if (savedCustom.has(dedupKey(c.baseUrl, c.modelId, c.name))) {
      skipped.push({ item: c.item, reason: REASON_ALREADY_SAVED });
      continue;
    }
    if (room <= 0) {
      skipped.push({ item: c.item, reason: REASON_CAP });
      continue;
    }
    try {
      const created = await ProviderCredential.create({
        _id: c._id,
        userId,
        slot: c.slot,
        kind: 'custom',
        name: c.name,
        baseUrl: c.baseUrl,
        modelId: c.modelId,
        ...(c.headerType ? { headerType: c.headerType } : {}),
        enabled: c.enabled,
        ct: c.fields.ct,
        iv: c.fields.iv,
        tag: c.fields.tag,
        keyVersion: c.fields.keyVersion,
        last4: c.fields.last4,
      });
      moved.custom.push(publicView(created) as PublicCustomCredential);
      room--;
    } catch (err) {
      logError('create', err);
      skipped.push({ item: c.item, reason: REASON_SAVE_FAILED });
    }
  }

  return respond();
}
