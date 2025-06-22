
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useE2ECrypto } from '@/hooks/useE2ECrypto';
import { fetchPublicKey } from '@/utils/publicKeyManager';

interface Message {
  id: string;
  content_encrypted: string;
  iv: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  decrypted_content?: string;
}

export const useMessageSending = (conversationId: string | null) => {
  const { user } = useAuth();
  const { encryptMessage } = useE2ECrypto();
  const mountedRef = useRef(true);

  // Get recipient user ID for the conversation
  const getRecipientUserId = useCallback(async (convId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', convId)
      .neq('user_id', user?.id);

    if (error || !data || data.length === 0) {
      throw new Error('Failed to find recipient');
    }

    return data[0].user_id;
  }, [user?.id]);

  // Server-side encryption fallback
  const encryptMessageServerSide = useCallback(async (content: string, convId: string): Promise<{ encryptedMessage: string; iv: string }> => {
    console.log('Using server-side encryption fallback...');
    
    const { data, error } = await supabase.functions.invoke('encryption', {
      body: {
        action: 'encrypt',
        conversationId: convId,
        message: content
      }
    });

    if (error) {
      throw new Error(`Server-side encryption failed: ${error.message}`);
    }

    return {
      encryptedMessage: data.encrypted,
      iv: data.iv
    };
  }, []);

  const sendMessage = useCallback(async (content: string): Promise<Message> => {
    if (!conversationId || !content.trim() || !user || !mountedRef.current) {
      throw new Error('Missing required parameters for sending message');
    }

    try {
      console.log('Attempting to send message...');
      
      let encryptedMessage: string;
      let iv: string;
      let encryptionMethod = 'client-side';

      try {
        // First, try client-side E2EE
        const recipientUserId = await getRecipientUserId(conversationId);
        const recipientPublicKey = await fetchPublicKey(recipientUserId);
        
        console.log('Encrypting message using client-side E2EE...');
        const clientEncryption = await encryptMessage(content, recipientPublicKey);
        encryptedMessage = clientEncryption.encryptedMessage;
        iv = clientEncryption.iv;
        
      } catch (keyError) {
        console.log('Client-side encryption failed, falling back to server-side:', keyError.message);
        
        // Fallback to server-side encryption
        try {
          const serverEncryption = await encryptMessageServerSide(content, conversationId);
          encryptedMessage = serverEncryption.encryptedMessage;
          iv = serverEncryption.iv;
          encryptionMethod = 'server-side';
        } catch (serverError) {
          console.error('Server-side encryption also failed:', serverError);
          throw new Error('Both client-side and server-side encryption failed. Message could not be sent securely.');
        }
      }
      
      console.log(`Message encrypted using ${encryptionMethod} encryption, saving to database...`);
      
      // Save encrypted message to database
      let retryCount = 0;
      const maxRetries = 2;
      let messageData;
      
      while (retryCount <= maxRetries && mountedRef.current) {
        try {
          const { data, error: saveError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: user.id,
              content_encrypted: encryptedMessage,
              iv: iv
            })
            .select()
            .single();

          if (saveError) {
            throw saveError;
          }
          
          messageData = data;
          break;
        } catch (error) {
          retryCount++;
          console.error(`Save attempt ${retryCount} failed:`, error);
          
          if (retryCount > maxRetries) {
            throw new Error('Failed to save message after multiple attempts');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!messageData || !mountedRef.current) {
        throw new Error('Message save failed or component unmounted');
      }

      // Return the message with decrypted content for the sender
      const newMessage: Message = {
        ...messageData,
        decrypted_content: content
      };
      
      console.log(`Message sent successfully using ${encryptionMethod} encryption`);
      return newMessage;

    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error.message.includes('timeout')) {
        throw new Error('Message sending timed out. Please check your connection and try again.');
      } else if (error.message.includes('Both client-side and server-side encryption failed')) {
        throw error; // Re-throw the specific encryption error
      } else if (error.message.includes('encrypt')) {
        throw new Error('Failed to encrypt message. The message was sent using server-side encryption instead.');
      } else {
        throw new Error('Failed to send message. Please try again.');
      }
    }
  }, [conversationId, user, getRecipientUserId, encryptMessage, encryptMessageServerSide]);

  return {
    sendMessage,
    mountedRef
  };
};
