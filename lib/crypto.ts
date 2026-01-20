/**
 * Encryption utilities using Web Crypto API
 * Uses AES-256-GCM for authenticated encryption
 */

// Salt for key derivation (public, used with PBKDF2)
const SALT_PREFIX = 'winqa-api-keys-v1';

// Convert string to ArrayBuffer
function stringToBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(str);
  return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
}

// Convert ArrayBuffer to string
function bufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

// Convert ArrayBuffer to base64 string
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive an encryption key from user ID using PBKDF2
 */
async function deriveKey(userId: string): Promise<CryptoKey> {
  // Create a consistent salt from the prefix and a hash concept
  const salt = stringToBuffer(`${SALT_PREFIX}-${userId.slice(0, 8)}`);

  // Import the user ID as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedData {
  iv: string;      // Base64 encoded IV
  data: string;    // Base64 encoded ciphertext
}

/**
 * Encrypt an API key using AES-256-GCM
 * @param plainKey - The plain text API key
 * @param userId - Clerk user ID used for key derivation
 * @returns Encrypted data object with IV and ciphertext
 */
export async function encryptApiKey(
  plainKey: string,
  userId: string
): Promise<EncryptedData> {
  if (!plainKey || !userId) {
    throw new Error('Both plainKey and userId are required');
  }

  const key = await deriveKey(userId);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    stringToBuffer(plainKey)
  );

  return {
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(encrypted),
  };
}

/**
 * Decrypt an API key using AES-256-GCM
 * @param encryptedData - The encrypted data object
 * @param userId - Clerk user ID used for key derivation
 * @returns The decrypted plain text API key
 */
export async function decryptApiKey(
  encryptedData: EncryptedData,
  userId: string
): Promise<string> {
  if (!encryptedData?.iv || !encryptedData?.data || !userId) {
    throw new Error('Invalid encrypted data or missing userId');
  }

  const key = await deriveKey(userId);
  const iv = new Uint8Array(base64ToBuffer(encryptedData.iv));
  const ciphertext = base64ToBuffer(encryptedData.data);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return bufferToString(decrypted);
  } catch {
    throw new Error('Decryption failed - data may be corrupted or key mismatch');
  }
}

/**
 * Encrypt multiple API keys at once
 */
export async function encryptApiKeys(
  keys: Record<string, string | undefined>,
  userId: string
): Promise<Record<string, EncryptedData>> {
  const encrypted: Record<string, EncryptedData> = {};

  for (const [provider, key] of Object.entries(keys)) {
    if (key && key.trim()) {
      encrypted[provider] = await encryptApiKey(key.trim(), userId);
    }
  }

  return encrypted;
}

/**
 * Decrypt multiple API keys at once
 */
export async function decryptApiKeys(
  encryptedKeys: Record<string, EncryptedData>,
  userId: string
): Promise<Record<string, string>> {
  const decrypted: Record<string, string> = {};

  for (const [provider, encData] of Object.entries(encryptedKeys)) {
    try {
      decrypted[provider] = await decryptApiKey(encData, userId);
    } catch {
      // Skip keys that fail to decrypt (corrupted data)
      console.warn(`Failed to decrypt key for ${provider}, skipping`);
    }
  }

  return decrypted;
}

/**
 * Check if data appears to be in encrypted format
 */
export function isEncryptedFormat(data: unknown): data is { encrypted: true; keys: Record<string, EncryptedData> } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'encrypted' in data &&
    (data as { encrypted: unknown }).encrypted === true &&
    'keys' in data
  );
}
