import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetKeyRingForTests,
  credentialAad,
  decryptSecret,
  encryptSecret,
} from '../lib/server/key-vault';
import {
  applyLeftOldVersions,
  currentKeyVersion,
  parseMode,
  planRewrap,
  type StoredCredential,
} from './rewrap-keys';

const K1 = randomBytes(32).toString('base64');
const K2 = randomBytes(32).toString('base64');
const ID = new Types.ObjectId();
const USER = 'user_rewrap_test';
const SLOT = 'groq';
const PLAIN = 'gsk_test_key_1234567890abcdef';

function setRing(raw: string): void {
  process.env.KEY_ENCRYPTION_KEYS = raw;
  _resetKeyRingForTests();
}

function v1Record(): StoredCredential {
  setRing(`v1:${K1}`);
  const rec = encryptSecret(PLAIN, credentialAad(USER, SLOT));
  return { _id: ID, userId: USER, slot: SLOT, ...rec };
}

describe('parseMode', () => {
  it('accepts exactly one flag and refuses anything else', () => {
    expect(parseMode(['--dry-run'])).toBe('dry-run');
    expect(parseMode(['--apply'])).toBe('apply');
    expect(parseMode([])).toBeNull();
    expect(parseMode(['--dry-run', '--apply'])).toBeNull();
    expect(parseMode(['--force'])).toBeNull();
  });
});

describe('planRewrap', () => {
  const saved = process.env.KEY_ENCRYPTION_KEYS;
  beforeEach(() => _resetKeyRingForTests());
  afterEach(() => {
    if (saved === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
    else process.env.KEY_ENCRYPTION_KEYS = saved;
    _resetKeyRingForTests();
  });

  it('reads the current version from the first ring entry', () => {
    setRing(`v2:${K2},v1:${K1}`);
    expect(currentKeyVersion()).toBe('v2');
  });

  it('a v1 record becomes v2 and still decrypts to the same value', () => {
    const doc = v1Record();
    setRing(`v2:${K2},v1:${K1}`);
    const plan = planRewrap(doc, 'v2');
    expect(plan.kind).toBe('rewrap');
    if (plan.kind !== 'rewrap') return;
    expect(plan.filter).toEqual({ _id: ID, ct: doc.ct, keyVersion: 'v1' });
    expect(plan.update.$set.keyVersion).toBe('v2');
    expect(plan.update.$set.ct).not.toBe(doc.ct);
    // Decrypts under v2 alone: v1 is no longer needed for this row.
    setRing(`v2:${K2}`);
    const out = decryptSecret(
      { ...plan.update.$set },
      credentialAad(USER, SLOT)
    );
    expect(out).toBe(PLAIN);
  });

  it('a record already under the current version is left alone', () => {
    const doc = v1Record();
    setRing(`v1:${K1}`);
    expect(planRewrap(doc, 'v1')).toEqual({ kind: 'current' });
  });

  it('a decrypt failure produces no update', () => {
    const doc = v1Record();
    setRing(`v2:${K2},v1:${K1}`);
    const tampered = { ...doc, ct: Buffer.from('not the ciphertext').toString('base64') };
    expect(planRewrap(tampered, 'v2')).toEqual({
      kind: 'decrypt-failed',
      error: 'KeyVaultDecryptError',
    });
    const wrongUser = { ...doc, userId: 'user_other' };
    expect(planRewrap(wrongUser, 'v2').kind).toBe('decrypt-failed');
  });

  it('a version missing from the ring is counted, never written', () => {
    const doc = v1Record();
    setRing(`v2:${K2}`);
    expect(planRewrap(doc, 'v2')).toEqual({ kind: 'decrypt-failed', error: 'KeyVersionUnknown' });
  });
});

describe('applyLeftOldVersions', () => {
  it('fails only an --apply that left old rows', () => {
    expect(applyLeftOldVersions('apply', 0)).toBe(false);
    expect(applyLeftOldVersions('apply', 3)).toBe(true);
    expect(applyLeftOldVersions('dry-run', 3)).toBe(false);
  });
});
