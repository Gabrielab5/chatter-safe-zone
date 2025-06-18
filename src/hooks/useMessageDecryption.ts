
import { useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user, sessionPrivateKey } = useAuth();
  const isDecryptingRef = useRef(false);
  const mountedRef = useRef(true);

  const decryptClientMessage = useCallback(async (message: Message): Promise<Message> => {
    if (!user?.id || !mountedRef.current) return message;

    // If no session key is available, show locked message
    if (!sessionPrivateKey) {
      return {
        ...message,
        decrypted_content: '🔒 Messages locked - unlock to decrypt'
      };
    }

    try {
      // Decode the encrypted message and IV
      const encryptedData = new Uint8Array(atob(message.content_encrypted).split('').map(c => c.charCodeAt(0)));
      const ivBytes = new Uint8Array(atob(message.iv).split('').map(c => c.charCodeAt(0)));
      
      // The first 256 bytes are the encrypted AES key (RSA-OAEP with 2048-bit key)
      const encryptedAESKey = encryptedData.slice(0, 256);
      const encryptedMessageData = encryptedData.slice(256);
      
      // Decrypt the AES key with RSA using the session private key
      const decryptedAESKeyData = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        sessionPrivateKey,
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
      
      return {
        ...message,
        decrypted_content: plainText
      };
    } catch (error) {
      console.error('Decryption error for message:', message.id, error);
      return {
        ...message,
        decrypted_content: '🔒 Failed to decrypt message'
      };
    }
  }, [user?.id, sessionPrivateKey]);

  // Enhanced batch decryption with better error handling and performance
  const processBatchDecryption = useCallback(async (messagesToDecrypt: Message[]): Promise<Message[]> => {
    if (isDecryptingRef.current || messagesToDecrypt.length === 0 || !mountedRef.current) {
      return messagesToDecrypt;
    }
    
    isDecryptingRef.current = true;
    
    try {
      const batchSize = 3;
      const decryptedMessages: Message[] = [];
      
      for (let i = 0; i < messagesToDecrypt.length; i += batchSize) {
        if (!mountedRef.current) break;
        
        const batch = messagesToDecrypt.slice(i, i + batchSize);
        
        const decryptPromises = batch.map(async (msg) => {
          try {
            return await decryptClientMessage(msg);
          } catch (error) {
            console.error('Batch decryption error for message:', msg.id, error);
            return {
              ...msg,
              decrypted_content: '🔒 Decryption failed'
            };
          }
        });
        
        try {
          const decryptedBatch = await Promise.allSettled(decryptPromises);
          
          decryptedBatch.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              decryptedMessages.push(result.value);
            } else {
              console.error('Decryption failed for message:', batch[index].id, result.reason);
              decryptedMessages.push({
                ...batch[index],
                decrypted_content: '🔒 Decryption error'
              });
            }
          });
          
          // Small delay between batches to prevent overwhelming
          if (i + batchSize < messagesToDecrypt.length && mountedRef.current) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error('Batch processing error:', error);
          batch.forEach(msg => {
            decryptedMessages.push({
              ...msg,
              decrypted_content: '🔒 Processing error'
            });
          });
        }
      }
      
      console.log(`Successfully processed ${decryptedMessages.length} messages`);
      return decryptedMessages;
      
    } finally {
      isDecryptingRef.current = false;
    }
  }, [decryptClientMessage]);

  return {
    decryptClientMessage,
    processBatchDecryption,
    mountedRef
  };
};
