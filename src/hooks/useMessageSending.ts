
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export const useMessageSending = (conversationId: string | null) => {
  const { user } = useAuth();
  const mountedRef = useRef(true);

  // Server-side encryption (only method now)
  const encryptMessageServerSide = useCallback(async (content: string, convId: string): Promise<{ encryptedMessage: string; iv: string }> => {
    console.log('Using server-side encryption for conversation:', convId);
    
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
      console.log('Sending message with server-side encryption only...');
      
      // Use server-side encryption only
      const { encryptedMessage, iv } = await encryptMessageServerSide(content, conversationId);
      
      console.log('Message encrypted using server-side encryption, saving to database...');
      
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
      
      console.log('Message sent successfully using server-side encryption');
      return newMessage;

    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error.message.includes('timeout')) {
        throw new Error('Message sending timed out. Please check your connection and try again.');
      } else if (error.message.includes('encrypt')) {
        throw new Error('Failed to encrypt message. Please try again.');
      } else {
        throw new Error('Failed to send message. Please try again.');
      }
    }
  }, [conversationId, user, encryptMessageServerSide]);

  return {
    sendMessage,
    mountedRef
  };
};
