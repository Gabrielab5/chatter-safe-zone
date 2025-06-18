
import { supabase } from '@/integrations/supabase/client';

// Upload public key to Supabase
export const uploadPublicKey = async (userId: string, publicKey: CryptoKey): Promise<void> => {
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
};

// Fetch public key from Supabase
export const fetchPublicKey = async (userId: string): Promise<JsonWebKey> => {
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

    return JSON.parse(data.public_key);
  } catch (error) {
    console.error('Failed to fetch public key:', error);
    throw new Error('Public key retrieval failed');
  }
};
