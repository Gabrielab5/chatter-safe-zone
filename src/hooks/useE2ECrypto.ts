
import { useState, useCallback } from 'react';
import { generateKeyPair, encryptPrivateKey, decryptPrivateKey } from '@/utils/cryptoUtils';
import { storeKeysSecurely, retrieveStoredKeys, StoredKeyData } from '@/utils/keyStorage';
import { uploadPublicKey, fetchPublicKey } from '@/utils/publicKeyManager';

export const useE2ECrypto = () => {
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

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
      
      // Store keys locally using the robust storage utility
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
  }, []);

  // Check if user has existing keys
  const hasExistingKeys = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const storedKeys = await retrieveStoredKeys(userId);
      return storedKeys !== null;
    } catch (error) {
      console.error('Failed to check for existing keys:', error);
      return false;
    }
  }, []);

  // Encrypt a message for a specific recipient
  const encryptMessage = useCallback(async (plainText: string, recipientPublicKeyJWK: JsonWebKey): Promise<{ encryptedMessage: string; iv: string }> => {
    setIsEncrypting(true);
    
    try {
      console.log('Encrypting message for recipient');
      
      // Import recipient's public key
      const recipientPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        recipientPublicKeyJWK,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
      );
      
      // Convert message to Uint8Array
      const messageData = new TextEncoder().encode(plainText);
      
      // Generate random IV (for hybrid encryption, we'll use AES for the actual message)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Generate a random AES key for this message
      const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      
      // Encrypt the message with AES
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        messageData
      );
      
      // Export the AES key and encrypt it with RSA
      const exportedAESKey = await window.crypto.subtle.exportKey("raw", aesKey);
      const encryptedAESKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        exportedAESKey
      );
      
      // Combine encrypted AES key and encrypted data
      const combined = new Uint8Array(encryptedAESKey.byteLength + encryptedData.byteLength);
      combined.set(new Uint8Array(encryptedAESKey), 0);
      combined.set(new Uint8Array(encryptedData), encryptedAESKey.byteLength);
      
      const encryptedMessage = btoa(String.fromCharCode(...combined));
      const ivBase64 = btoa(String.fromCharCode(...iv));
      
      console.log('Message encrypted successfully');
      return { encryptedMessage, iv: ivBase64 };
      
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      throw new Error('Message encryption failed');
    } finally {
      setIsEncrypting(false);
    }
  }, []);

  // Decrypt a message using the user's private key
  const decryptMessage = useCallback(async (encryptedMessage: string, iv: string, userId: string, userPassword: string): Promise<string> => {
    setIsDecrypting(true);
    
    try {
      console.log('Decrypting message for user:', userId);
      
      // Retrieve user's stored keys
      const storedKeys = await retrieveStoredKeys(userId);
      if (!storedKeys) {
        throw new Error('No encryption keys found for user');
      }
      
      // Decrypt the private key
      const privateKey = await decryptPrivateKey(
        storedKeys.encryptedPrivateKey,
        storedKeys.salt,
        userPassword
      );
      
      // Decode the encrypted message and IV
      const encryptedData = new Uint8Array(atob(encryptedMessage).split('').map(c => c.charCodeAt(0)));
      const ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
      
      // The first 256 bytes are the encrypted AES key (RSA-OAEP with 2048-bit key)
      const encryptedAESKey = encryptedData.slice(0, 256);
      const encryptedMessageData = encryptedData.slice(256);
      
      // Decrypt the AES key with RSA
      const decryptedAESKeyData = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedAESKey
      );
      
      // Import the decrypted AES key
      const aesKey = await window.crypto.subtle.importKey(
        "raw",
        decryptedAESKeyData,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );
      
      // Decrypt the message with AES
      const decryptedData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        aesKey,
        encryptedMessageData
      );
      
      const plainText = new TextDecoder().decode(decryptedData);
      console.log('Message decrypted successfully');
      return plainText;
      
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      throw new Error('Message decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  }, []);

  return {
    generateAndStoreKeys,
    hasExistingKeys,
    retrieveStoredKeys,
    decryptPrivateKey,
    encryptMessage,
    decryptMessage,
    isGeneratingKeys,
    isEncrypting,
    isDecrypting
  };
};
