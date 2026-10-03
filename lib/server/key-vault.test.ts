import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  credentialAad,
  KeyVaultNotConfigured,
  KeyVersionUnknown,
  KeyVaultDecryptError,
  _resetKeyRingForTests,
  type EncryptedSecret,
} from '@/lib/server/key-vault';

// Test-only keys, generated per run; nothing here is a real secret.
const newKey = (bytes = 32) => randomBytes(bytes).toString('base64');
const PLAIN = 'sk-test-plaintext-0123456789abcdef';
const AAD = credentialAad('user_alice', 'groq');

let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env.KEY_ENCRYPTION_KEYS;
  _resetKeyRingForTests();
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.KEY_ENCRYPTION_KEYS;
  else process.env.KEY_ENCRYPTION_KEYS = savedEnv;
  _resetKeyRingForTests();
});

function flipByte(b64: string, index = 0): string {
  const buf = Buffer.from(b64, 'base64');
  buf[index] ^= 0x01;
  return buf.toString('base64');
}

function caught(fn: () => unknown): Error {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected a throw');
}

describe('key-vault', () => {
  it('round trips a secret', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    expect(rec.keyVersion).toBe('v1');
    expect(Buffer.from(rec.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(rec.tag, 'base64')).toHaveLength(16);
    expect(rec.ct).not.toContain(PLAIN);
    expect(decryptSecret(rec, AAD)).toBe(PLAIN);
  });

  it('a flipped byte in ct throws KeyVaultDecryptError', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    expect(() => decryptSecret({ ...rec, ct: flipByte(rec.ct, 3) }, AAD)).toThrow(
      KeyVaultDecryptError
    );
  });

  it('a flipped byte in tag throws KeyVaultDecryptError', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    expect(() => decryptSecret({ ...rec, tag: flipByte(rec.tag, 15) }, AAD)).toThrow(
      KeyVaultDecryptError
    );
  });

  it('a truncated tag throws KeyVaultDecryptError', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    const short = Buffer.from(rec.tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => decryptSecret({ ...rec, tag: short }, AAD)).toThrow(KeyVaultDecryptError);
  });

  it("the same record under another user's AAD, or another slot, throws", () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    expect(() => decryptSecret(rec, credentialAad('user_bob', 'groq'))).toThrow(
      KeyVaultDecryptError
    );
    expect(() => decryptSecret(rec, credentialAad('user_alice', 'cohere'))).toThrow(
      KeyVaultDecryptError
    );
  });

  it('credentialAad builds the documented string and rejects ":" in the user id', () => {
    expect(credentialAad('user_alice', 'custom:abc123')).toBe(
      'winqa-key:v1:user_alice:custom:abc123'
    );
    expect(() => credentialAad('user:alice', 'groq')).toThrow(TypeError);
    expect(() => credentialAad('', 'groq')).toThrow(TypeError);
    expect(() => credentialAad('user_alice', '')).toThrow(TypeError);
  });

  it('a v2,v1 ring encrypts with v2, and a record made under v1 alone still decrypts', () => {
    const k1 = newKey();
    const k2 = newKey();
    process.env.KEY_ENCRYPTION_KEYS = `v1:${k1}`;
    const oldRec = encryptSecret(PLAIN, AAD);
    expect(oldRec.keyVersion).toBe('v1');

    process.env.KEY_ENCRYPTION_KEYS = `v2:${k2},v1:${k1}`;
    const newRec = encryptSecret(PLAIN, AAD);
    expect(newRec.keyVersion).toBe('v2');
    expect(decryptSecret(newRec, AAD)).toBe(PLAIN);
    expect(decryptSecret(oldRec, AAD)).toBe(PLAIN);
  });

  it('tolerates whitespace around entries', () => {
    process.env.KEY_ENCRYPTION_KEYS = `  v2:${newKey()} ,\n v1:${newKey()}  `;
    expect(encryptSecret(PLAIN, AAD).keyVersion).toBe('v2');
  });

  it('an unknown key version throws KeyVersionUnknown', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v2:${newKey()},v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    expect(() => decryptSecret({ ...rec, keyVersion: 'v3' }, AAD)).toThrow(KeyVersionUnknown);
    // A ring that dropped v1 cannot read a v1 record.
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const v1Rec = encryptSecret(PLAIN, AAD);
    process.env.KEY_ENCRYPTION_KEYS = `v2:${newKey()}`;
    expect(() => decryptSecret(v1Rec, AAD)).toThrow(KeyVersionUnknown);
  });

  it('a missing env throws KeyVaultNotConfigured at call time; importing without it does not throw', async () => {
    delete process.env.KEY_ENCRYPTION_KEYS;
    vi.resetModules();
    const mod = await import('@/lib/server/key-vault');
    expect(() => mod.encryptSecret(PLAIN, AAD)).toThrow(mod.KeyVaultNotConfigured);
    const rec: EncryptedSecret = { ct: 'AAAA', iv: 'AAAAAAAAAAAAAAAA', tag: 'AAAAAAAAAAAAAAAAAAAAAA==', keyVersion: 'v1' };
    expect(() => mod.decryptSecret(rec, AAD)).toThrow(mod.KeyVaultNotConfigured);

    process.env.KEY_ENCRYPTION_KEYS = '   ';
    expect(() => mod.encryptSecret(PLAIN, AAD)).toThrow(mod.KeyVaultNotConfigured);
  });

  it('a 31-byte (or 33-byte) entry throws KeyVaultNotConfigured', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey(31)}`;
    expect(() => encryptSecret(PLAIN, AAD)).toThrow(KeyVaultNotConfigured);
    process.env.KEY_ENCRYPTION_KEYS = `v2:${newKey()},v1:${newKey(33)}`;
    expect(() => encryptSecret(PLAIN, AAD)).toThrow(KeyVaultNotConfigured);
  });

  it('a malformed label, a duplicate label, a missing separator, bad base64 or an empty entry throws KeyVaultNotConfigured', () => {
    const k = newKey();
    for (const ring of [
      `1:${k}`,
      `V1:${k}`,
      `v1a:${k}`,
      `key:${k}`,
      `:${k}`,
      `v1:${k},v1:${newKey()}`,
      k,
      `v1:${k.slice(0, -2)}!!`,
      `v1:${k},`,
      `v1:${k},,v2:${newKey()}`,
    ]) {
      process.env.KEY_ENCRYPTION_KEYS = ring;
      _resetKeyRingForTests();
      expect(() => encryptSecret(PLAIN, AAD), ring).toThrow(KeyVaultNotConfigured);
    }
  });

  it('a fixed env is picked up without a reset (the cache follows the env value)', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey(31)}`;
    expect(() => encryptSecret(PLAIN, AAD)).toThrow(KeyVaultNotConfigured);
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    expect(encryptSecret(PLAIN, AAD).keyVersion).toBe('v1');
  });

  it('two encryptions of the same plaintext give different IVs and different ct', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const a = encryptSecret(PLAIN, AAD);
    const b = encryptSecret(PLAIN, AAD);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    expect(decryptSecret(a, AAD)).toBe(PLAIN);
    expect(decryptSecret(b, AAD)).toBe(PLAIN);
  });

  it('malformed record fields throw KeyVaultDecryptError, not a raw Node error', () => {
    process.env.KEY_ENCRYPTION_KEYS = `v1:${newKey()}`;
    const rec = encryptSecret(PLAIN, AAD);
    const shortIv = Buffer.from(rec.iv, 'base64').subarray(0, 8).toString('base64');
    expect(() => decryptSecret({ ...rec, iv: shortIv }, AAD)).toThrow(KeyVaultDecryptError);
    expect(() => decryptSecret({ ...rec, ct: '%%%' }, AAD)).toThrow(KeyVaultDecryptError);
    expect(() =>
      decryptSecret({ ...rec, tag: undefined as unknown as string }, AAD)
    ).toThrow(KeyVaultDecryptError);
  });

  it('error messages contain neither the plaintext nor any key material or ciphertext', () => {
    const k1 = newKey();
    const k2 = newKey();
    const short = newKey(31);
    process.env.KEY_ENCRYPTION_KEYS = `v2:${k2},v1:${k1}`;
    const rec = encryptSecret(PLAIN, AAD);

    const errors: Error[] = [
      caught(() => decryptSecret({ ...rec, ct: flipByte(rec.ct) }, AAD)),
      caught(() => decryptSecret({ ...rec, tag: flipByte(rec.tag) }, AAD)),
      caught(() => decryptSecret(rec, credentialAad('user_bob', 'groq'))),
      caught(() => decryptSecret({ ...rec, keyVersion: 'v9' }, AAD)),
    ];
    process.env.KEY_ENCRYPTION_KEYS = `v2:${k2},v1:${short}`;
    errors.push(caught(() => encryptSecret(PLAIN, AAD)));
    process.env.KEY_ENCRYPTION_KEYS = `v2:${k2},v2:${k1}`;
    errors.push(caught(() => encryptSecret(PLAIN, AAD)));
    process.env.KEY_ENCRYPTION_KEYS = `bad:${k1}`;
    errors.push(caught(() => decryptSecret(rec, AAD)));
    delete process.env.KEY_ENCRYPTION_KEYS;
    errors.push(caught(() => encryptSecret(PLAIN, AAD)));

    const forbidden = [PLAIN, k1, k2, short, rec.ct, rec.tag, rec.iv, 'user_alice'];
    expect(errors.map((e) => e.name)).toEqual([
      'KeyVaultDecryptError',
      'KeyVaultDecryptError',
      'KeyVaultDecryptError',
      'KeyVersionUnknown',
      'KeyVaultNotConfigured',
      'KeyVaultNotConfigured',
      'KeyVaultNotConfigured',
      'KeyVaultNotConfigured',
    ]);
    for (const e of errors) {
      for (const secret of forbidden) {
        expect(e.message).not.toContain(secret);
        expect(String(e.stack ?? '')).not.toContain(secret);
      }
      expect(e.message).not.toMatch(/authenticate data/i);
    }
  });
});
