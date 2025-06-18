
import { useState, useCallback } from 'react';
import { generateKeyPair, encryptPrivateKey, decryptPrivateKey } from '@/utils/cryptoUtils';
import { storeKeysSecurely, retrieveStoredKeys, StoredKeyData } from '@/utils/keyStorage';
import { uploadPublicKey } from '@/utils/publicKeyManager';

export const useE2ECrypto = () => {
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

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

  return {
    generateAndStoreKeys,
    hasExistingKeys,
    retrieveStoredKeys,
    decryptPrivateKey,
    isGeneratingKeys
  };
};
