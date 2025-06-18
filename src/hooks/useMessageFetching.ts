
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

export const useMessageFetching = () => {
  const { user } = useAuth();
  const mountedRef = useRef(true);

  const fetchMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    if (!conversationId || !user || !mountedRef.current) {
      return [];
    }

    try {
      console.log('Fetching messages for conversation:', conversationId);
      
      // Enhanced message fetching with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let messageData;

      while (retryCount < maxRetries && mountedRef.current) {
        try {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(100);

          if (error) {
            throw error;
          }

          messageData = data;
          break;
        } catch (error) {
          retryCount++;
          console.error(`Message fetch attempt ${retryCount} failed:`, error);
          
          if (retryCount >= maxRetries) {
            throw new Error('Failed to load messages. Please try refreshing.');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (messageData && messageData.length > 0 && mountedRef.current) {
        console.log(`Found ${messageData.length} messages`);
        return messageData as Message[];
      } else if (mountedRef.current) {
        console.log('No messages found for conversation');
        return [];
      }

      return [];
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      throw new Error('Failed to load messages. Please check your connection.');
    }
  }, [user]);

  return {
    fetchMessages,
    mountedRef
  };
};
