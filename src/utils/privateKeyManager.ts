import { supabase } from "@/integrations/supabase/client";

// Encrypt and upload private key to session_keys table
export const uploadPrivateKey = async (
  userId: string,
  privateKey: CryptoKey
): Promise<void> => {
  try {
    // Step 1: Export the private key to PKCS8 (binary format)
    const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);

    // Step 2: Convert to base64 for storing as text
    const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));

    // Step 3: Set timestamps
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 7
    ).toISOString(); // 7 days ahead

    // Step 4: Insert into Supabase
    const { error } = await supabase.from("session_keys").upsert({
      user_id: userId,
      key_encrypted: base64Key,
      created_at: createdAt,
      expires_at: expiresAt,
    });

    if (error) {
      throw new Error(`Failed to upload private key: ${error.message}`);
    }

    console.log("✅ Private key uploaded to session_keys for user:", userId);
  } catch (err) {
    console.error("❌ Error in uploadPrivateKey:", err);
    throw err;
  }
};
