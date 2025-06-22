
import { useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useE2ECrypto } from '@/hooks/useE2ECrypto';
import { supabase } from '@/integrations/supabase/client';

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
  const { decryptMessage } = useE2ECrypto();
  const mountedRef = useRef(true);

  // Server-side decryption fallback
  const decryptMessageServerSide = useCallback(async (message: Message): Promise<string> => {
    console.log('Attempting server-side decryption for message:', message.id);
    
    const { data, error } = await supabase.functions.invoke('encryption', {
      body: {
        action: 'decrypt',
        conversationId: message.conversation_id,
        encryptedMessage: message.content_encrypted,
        iv: message.iv
      }
    });

    if (error) {
      throw new Error(`Server-side decryption failed: ${error.message}`);
    }

    return data.message;
  }, []);

  const decryptSingleMessage = useCallback(async (message: Message): Promise<Message> => {
    if (!user?.id || !mountedRef.current) {
      return { ...message, decrypted_content: 'User not authenticated' };
    }

    // If already decrypted, return as is
    if (message.decrypted_content !== undefined) {
      return message;
    }

    try {
      let decryptedContent: string;

      // First try client-side decryption if user has unlocked their session key
      if (sessionPrivateKey) {
        try {
          console.log('Attempting client-side decryption for message:', message.id);
          // For client-side decryption, we would need to implement a different approach
          // since we have the private key directly instead of a password
          // For now, let's fallback to server-side
          throw new Error('Client-side decryption with session key not yet implemented');
        } catch (clientError) {
          console.log('Client-side decryption failed, trying server-side:', clientError.message);
          
          // Fallback to server-side decryption
          try {
            decryptedContent = await decryptMessageServerSide(message);
            console.log('Server-side decryption successful');
          } catch (serverError) {
            console.error('Both decryption methods failed:', serverError);
            decryptedContent = 'Failed to decrypt message';
          }
        }
      } else {
        // No client-side session key available, try server-side only
        try {
          decryptedContent = await decryptMessageServerSide(message);
          console.log('Server-side decryption successful (no session key)');
        } catch (serverError) {
          console.error('Server-side decryption failed:', serverError);
          decryptedContent = 'Failed to decrypt message';
        }
      }

      return {
        ...message,
        decrypted_content: decryptedContent
      };
    } catch (error) {
      console.error('Error in decryptSingleMessage:', error);
      return {
        ...message,
        decrypted_content: 'Decryption error'
      };
    }
  }, [user?.id, sessionPrivateKey, decryptMessage, decryptMessageServerSide, mountedRef]);

  const processBatchDecryption = useCallback(async (messages: Message[]): Promise<Message[]> => {
    if (!mountedRef.current || messages.length === 0) {
      return messages;
    }

    try {
      console.log(`Processing batch decryption for ${messages.length} messages`);
      
      const decryptionPromises = messages.map(message => decryptSingleMessage(message));
      const decryptedMessages = await Promise.all(decryptionPromises);
      
      if (mountedRef.current) {
        console.log('Batch decryption completed successfully');
        return decryptedMessages;
      }
      
      return messages;
    } catch (error) {
      console.error('Error in batch decryption:', error);
      return messages.map(msg => ({
        ...msg,
        decrypted_content: msg.decrypted_content || 'Decryption failed'
      }));
    }
  }, [decryptSingleMessage, mountedRef]);

  return {
    processBatchDecryption,
    decryptSingleMessage,
    mountedRef
  };
};
