
interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// Generate asymmetric key pair using Web Crypto API
export const generateKeyPair = async (): Promise<KeyPair> => {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: "SHA-256"
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
    
    return keyPair as KeyPair;
  } catch (error) {
    console.error('Failed to generate key pair:', error);
    throw new Error('Key generation failed');
  }
};

// Derive a key from password using PBKDF2
export const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  try {
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    console.error('Failed to derive key from password:', error);
    throw new Error('Key derivation failed');
  }
};

// Encrypt private key with password-derived key
export const encryptPrivateKey = async (privateKey: CryptoKey, password: string): Promise<{ encryptedKey: string; salt: string }> => {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await deriveKeyFromPassword(password, salt);
    
    const exportedPrivateKey = await window.crypto.subtle.exportKey("jwk", privateKey);
    const privateKeyData = new TextEncoder().encode(JSON.stringify(exportedPrivateKey));
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      derivedKey,
      privateKeyData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return {
      encryptedKey: btoa(String.fromCharCode(...combined)),
      salt: btoa(String.fromCharCode(...salt))
    };
  } catch (error) {
    console.error('Failed to encrypt private key:', error);
    throw new Error('Private key encryption failed');
  }
};

// Decrypt private key with password-derived key
export const decryptPrivateKey = async (encryptedKey: string, salt: string, password: string): Promise<CryptoKey> => {
  try {
    const saltBytes = new Uint8Array(atob(salt).split('').map(c => c.charCodeAt(0)));
    const derivedKey = await deriveKeyFromPassword(password, saltBytes);
    
    const combined = new Uint8Array(atob(encryptedKey).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      derivedKey,
      encryptedData
    );

    const privateKeyJWK = JSON.parse(new TextDecoder().decode(decryptedData));
    
    return await window.crypto.subtle.importKey(
      "jwk",
      privateKeyJWK,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );
  } catch (error) {
    console.error('Failed to decrypt private key:', error);
    throw new Error('Private key decryption failed');
  }
};
