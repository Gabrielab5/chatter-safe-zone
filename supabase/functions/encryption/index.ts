
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Generate a random key for AES-256
function generateKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Generate a random IV
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// Convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to string
function uint8ArrayToString(arr: Uint8Array): string {
  return new TextDecoder().decode(arr);
}

// Convert Uint8Array to hex string
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return result;
}

// Convert base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function encryptMessage(
  message: string,
  key: Uint8Array
): Promise<{ encrypted: string; iv: string }> {
  const iv = generateIV();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    stringToUint8Array(message)
  );

  return {
    encrypted: uint8ArrayToHex(new Uint8Array(encrypted)),
    iv: uint8ArrayToHex(iv),
  };
}

async function decryptMessage(
  encryptedHex: string,
  iv: Uint8Array,
  key: Uint8Array
): Promise<string> {
  const encrypted = hexToUint8Array(encryptedHex);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encrypted
  );

  return uint8ArrayToString(new Uint8Array(decrypted));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    const { action, conversationId, message, encryptedMessage, iv } =
      await req.json();

    if (action === "encrypt") {
      // Get or create session key for conversation
      const { data: conversation } = await supabase
        .from("conversations")
        .select("session_key_encrypted")
        .eq("id", conversationId)
        .single();

      let sessionKey: Uint8Array;

      if (conversation?.session_key_encrypted) {
        // Try to decrypt existing session key - handle both hex and base64 formats
        try {
          // First try as hex (our current format)
          sessionKey = hexToUint8Array(conversation.session_key_encrypted);
        } catch {
          // Fallback to base64 if hex parsing fails
          sessionKey = base64ToUint8Array(conversation.session_key_encrypted);
        }
      } else {
        // Generate new session key
        sessionKey = generateKey();

        // Store encrypted session key as hex
        await supabase
          .from("conversations")
          .update({ session_key_encrypted: uint8ArrayToHex(sessionKey) })
          .eq("id", conversationId);
      }

      const result = await encryptMessage(message, sessionKey);

      // Log audit event
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        event_type: "message_sent",
        event_data: { conversation_id: conversationId },
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "decrypt") {
      // Verify user has access to conversation
      const { data: participant } = await supabase
        .from("conversation_participants")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .single();

      if (!participant) {
        throw new Error("Unauthorized access to conversation");
      }

      // Get session key
      const { data: conversation } = await supabase
        .from("conversations")
        .select("session_key_encrypted")
        .eq("id", conversationId)
        .single();

      if (!conversation?.session_key_encrypted) {
        throw new Error("No session key found");
      }

      console.log("🔐 EncryptedMessage:", encryptedMessage);
      console.log("🔐 IV:", iv);
      console.log("🔐 Session key:", conversation?.session_key_encrypted);

      let sessionKey: Uint8Array;
      try {
        // Try to parse as hex first (our current format)
        sessionKey = hexToUint8Array(conversation.session_key_encrypted);
        console.log("🔑 Parsed session key as hex, length:", sessionKey.length);
      } catch (hexError) {
        console.log("⚠️ Hex parsing failed, trying base64:", hexError);
        try {
          // Fallback to base64
          sessionKey = base64ToUint8Array(conversation.session_key_encrypted);
          console.log("🔑 Parsed session key as base64, length:", sessionKey.length);
        } catch (base64Error) {
          console.log("❌ Both hex and base64 parsing failed:", base64Error);
          throw new Error("Invalid session key format");
        }
      }

      // Ensure the key is 32 bytes for AES-256
      if (sessionKey.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${sessionKey.length} bytes`);
      }

      let ivBytes: Uint8Array;
      try {
        // Try to parse IV as hex first
        ivBytes = hexToUint8Array(iv);
        console.log("🔑 Parsed IV as hex, length:", ivBytes.length);
      } catch (hexError) {
        console.log("⚠️ IV hex parsing failed, trying base64:", hexError);
        try {
          // Fallback to base64 for IV
          ivBytes = base64ToUint8Array(iv);
          console.log("🔑 Parsed IV as base64, length:", ivBytes.length);
        } catch (base64Error) {
          console.log("❌ Both IV hex and base64 parsing failed:", base64Error);
          throw new Error("Invalid IV format");
        }
      }

      const decryptedMessage = await decryptMessage(
        encryptedMessage,
        ivBytes,
        sessionKey
      );
      console.log("✅ Decryption succeeded");

      return new Response(JSON.stringify({ message: decryptedMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error(
      "Encryption error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
