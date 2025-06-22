
import { supabase } from '@/integrations/supabase/client';

// Upload public key to Supabase
export const uploadPublicKey = async (userId: string, publicKey: CryptoKey): Promise<void> => {
  try {
    const exportedPublicKey = await window.crypto.subtle.exportKey("spki", publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));
    
    const { error } = await supabase
      .from('profiles')
      .update({ public_key: publicKeyBase64 })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to upload public key: ${error.message}`);
    }
    
    console.log('Public key uploaded successfully for user:', userId);
  } catch (error) {
    console.error('Failed to upload public key:', error);
    throw new Error('Public key upload failed');
  }
};

// Fetch public key from Supabase with better error handling
export const fetchPublicKey = async (userId: string): Promise<CryptoKey> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('public_key')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch public key: ${error.message}`);
    }

    if (!data || !data.public_key) {
      throw new Error('No public key found for user');
    }

    // Convert base64 back to ArrayBuffer
    const publicKeyBuffer = Uint8Array.from(atob(data.public_key), c => c.charCodeAt(0));
    
    // Import the public key
    const publicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    return publicKey;
  } catch (error) {
    console.error('Failed to fetch public key for user:', userId, error);
    
    // Provide a more specific error message based on the type of failure
    if (error.message.includes('No public key found') || error.message.includes('single row')) {
      throw new Error('No public key found for user');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('Public key retrieval failed');
    } else {
      throw new Error('Public key retrieval failed');
    }
  }
};
