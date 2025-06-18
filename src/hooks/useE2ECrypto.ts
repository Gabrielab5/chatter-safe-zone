
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

interface StoredKeyData {
  encryptedPrivateKey: string;
  publicKeyJWK: JsonWebKey;
  salt: string;
}

export const useE2ECrypto = () => {
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  // Generate asymmetric key pair using Web Crypto API
  const generateKeyPair = useCallback(async (): Promise<KeyPair> => {
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
  }, []);

  // Derive a key from password using PBKDF2
  const deriveKeyFromPassword = useCallback(async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
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
  }, []);

  // Encrypt private key with password-derived key
  const encryptPrivateKey = useCallback(async (privateKey: CryptoKey, password: string): Promise<{ encryptedKey: string; salt: string }> => {
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
  }, [deriveKeyFromPassword]);

  // Decrypt private key with password-derived key
  const decryptPrivateKey = useCallback(async (encryptedKey: string, salt: string, password: string): Promise<CryptoKey> => {
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
  }, [deriveKeyFromPassword]);

  // Store keys securely in IndexedDB
  const storeKeysSecurely = useCallback(async (userId: string, keyData: StoredKeyData): Promise<void> => {
    try {
      const request = indexedDB.open('SecureTalkKeys', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys', { keyPath: 'userId' });
          }
        };
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['keys'], 'readwrite');
          const store = transaction.objectStore('keys');
          
          store.put({ userId, ...keyData });
          
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          
          transaction.onerror = () => {
            db.close();
            reject(new Error('Failed to store keys'));
          };
        };
      });
    } catch (error) {
      console.error('Failed to store keys:', error);
      throw new Error('Key storage failed');
    }
  }, []);

  // Retrieve keys from IndexedDB
  const retrieveStoredKeys = useCallback(async (userId: string): Promise<StoredKeyData | null> => {
    try {
      const request = indexedDB.open('SecureTalkKeys', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          const getRequest = store.get(userId);
          
          getRequest.onsuccess = () => {
            db.close();
            const result = getRequest.result;
            resolve(result ? {
              encryptedPrivateKey: result.encryptedPrivateKey,
              publicKeyJWK: result.publicKeyJWK,
              salt: result.salt
            } : null);
          };
          
          getRequest.onerror = () => {
            db.close();
            reject(new Error('Failed to retrieve keys'));
          };
        };
      });
    } catch (error) {
      console.error('Failed to retrieve keys:', error);
      throw new Error('Key retrieval failed');
    }
  }, []);

  // Upload public key to Supabase
  const uploadPublicKey = useCallback(async (userId: string, publicKey: CryptoKey): Promise<void> => {
    try {
      const exportedPublicKey = await window.crypto.subtle.exportKey("jwk", publicKey);
      
      const { error } = await supabase
        .from('profiles')
        .update({ public_key: JSON.stringify(exportedPublicKey) })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to upload public key: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to upload public key:', error);
      throw new Error('Public key upload failed');
    }
  }, []);

  // Main function to generate and store E2EE keys
  const generateAndStoreKeys = useCallback(async (userId: string, password: string): Promise<void> => {
    setIsGeneratingKeys(true);
    
    try {
      console.log('Generating E2EE key pair for user:', userId);
      
      // Generate key pair
      const keyPair = await generateKeyPair();
      
      // Export public key
      const publicKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
      
      // Encrypt private key with password
      const { encryptedKey, salt } = await encryptPrivateKey(keyPair.privateKey, password);
      
      // Store keys locally
      const keyData: StoredKeyData = {
        encryptedPrivateKey: encryptedKey,
        publicKeyJWK,
        salt
      };
      
      await storeKeysSecurely(userId, keyData);
      
      // Upload public key to Supabase
      await uploadPublicKey(userId, keyPair.publicKey);
      
      console.log('E2EE keys generated and stored successfully');
    } catch (error) {
      console.error('Failed to generate and store keys:', error);
      throw error;
    } finally {
      setIsGeneratingKeys(false);
    }
  }, [generateKeyPair, encryptPrivateKey, storeKeysSecurely, uploadPublicKey]);

  // Check if user has existing keys
  const hasExistingKeys = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const storedKeys = await retrieveStoredKeys(userId);
      return storedKeys !== null;
    } catch (error) {
      console.error('Failed to check for existing keys:', error);
      return false;
    }
  }, [retrieveStoredKeys]);

  return {
    generateAndStoreKeys,
    hasExistingKeys,
    retrieveStoredKeys,
    decryptPrivateKey,
    isGeneratingKeys
  };
};
