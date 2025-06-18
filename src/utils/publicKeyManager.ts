
import { supabase } from '@/integrations/supabase/client';

// Upload public key to Supabase
export const uploadPublicKey = async (userId: string, publicKey: CryptoKey): Promise<void> => {
  try {
    const exportedPublicKey = await window.crypto.subtle.exportKey("jwk", publicKey);
    
    // Use type assertion to bypass TypeScript checking for the new public_key column
    const { error } = await supabase
      .from('profiles')
      .update({ public_key: JSON.stringify(exportedPublicKey) } as any)
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to upload public key: ${error.message}`);
    }
  } catch (error) {
    console.error('Failed to upload public key:', error);
    throw new Error('Public key upload failed');
  }
};
