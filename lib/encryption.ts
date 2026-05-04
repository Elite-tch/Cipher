/**
 * End-to-End Encryption (E2EE) Utility for Cipher.
 * Uses Web Crypto API (AES-GCM) for privacy-preserving data routing on Logos/Waku.
 */

const ENCRYPTION_ALGO = 'AES-GCM';

/**
 * Derives a consistent symmetric key from a seed (e.g., a creator's public key or a shared secret).
 */
async function deriveKey(seed: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(seed),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('cipher_logos_salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a message string.
 * Returns a base64 string containing: salt (iv) + ciphertext.
 */
export async function encryptData(data: string, seed: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await deriveKey(seed);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGO, iv },
    key,
    enc.encode(data)
  );
  
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypts a base64 string.
 */
export async function decryptData(encryptedBase64: string, seed: string): Promise<string> {
  try {
    const raw = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);
    
    const key = await deriveKey(seed);
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGO, iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('[Encryption] Decryption failed:', err);
    return '[Encrypted Content — You do not have the required key]';
  }
}
