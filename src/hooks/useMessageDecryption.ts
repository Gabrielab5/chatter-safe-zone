
import { useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content_encrypted: string;
  iv: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  decrypted_content?: string;
}

export const useMessageDecryption = () => {
  const { user } = useAuth();
  const mountedRef = useRef(true);

  // Server-side decryption (only method now)
  const decryptMessageServerSide = useCallback(
    async (message: Message): Promise<string> => {
      console.log("📨 Invoking encryption function with:", {
        action: "decrypt",
        conversationId: message.conversation_id,
        encryptedMessage: message.content_encrypted,
        iv: message.iv,
      });

      const { data, error } = await supabase.functions.invoke("encryption", {
        body: {
          action: "decrypt",
          conversationId: message.conversation_id,
          encryptedMessage: message.content_encrypted,
          iv: message.iv,
        },
      });

      if (error) {
        throw new Error(`Server-side decryption failed: ${error.message}`);
      }

      return data.message;
    },
    []
  );

  const decryptSingleMessage = useCallback(
    async (message: Message): Promise<Message> => {
      if (!user?.id || !mountedRef.current) {
        return { ...message, decrypted_content: "User not authenticated" };
      }

      // If already decrypted, return as is
      if (message.decrypted_content !== undefined) {
        return message;
      }

      try {
        console.log('Attempting server-side decryption for message:', message.id);
        
        // Use server-side decryption only
        const decryptedContent = await decryptMessageServerSide(message);
        console.log('Server-side decryption successful');

        return {
          ...message,
          decrypted_content: decryptedContent,
        };
      } catch (error) {
        console.error('Server-side decryption failed:', error);
        return {
          ...message,
          decrypted_content: "Failed to decrypt message",
        };
      }
    },
    [user?.id, decryptMessageServerSide, mountedRef]
  );

  const processBatchDecryption = useCallback(
    async (messages: Message[]): Promise<Message[]> => {
      if (!mountedRef.current || messages.length === 0) {
        return messages;
      }

      try {
        console.log(
          `Processing batch decryption for ${messages.length} messages`
        );

        const decryptionPromises = messages.map((message) =>
          decryptSingleMessage(message)
        );
        const decryptedMessages = await Promise.all(decryptionPromises);

        if (mountedRef.current) {
          console.log("Batch decryption completed successfully");
          return decryptedMessages;
        }

        return messages;
      } catch (error) {
        console.error("Error in batch decryption:", error);
        return messages.map((msg) => ({
          ...msg,
          decrypted_content: msg.decrypted_content || "Decryption failed",
        }));
      }
    },
    [decryptSingleMessage, mountedRef]
  );

  return {
    processBatchDecryption,
    decryptSingleMessage,
    mountedRef,
  };
};
