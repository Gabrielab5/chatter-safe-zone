
import { useEffect, useState, useCallback } from 'react';
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

export const useRealTimeMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decryptMessage = useCallback(async (message: Message): Promise<Message> => {
    if (!conversationId) return message;

    try {
      const { data, error } = await supabase.functions.invoke('encryption', {
        body: {
          action: 'decrypt',
          conversationId: conversationId,
          encryptedMessage: message.content_encrypted,
          iv: message.iv
        }
      });

      if (error) {
        console.error('Decryption error:', error);
        return {
          ...message,
          decrypted_content: 'Failed to decrypt message'
        };
      }

      return {
        ...message,
        decrypted_content: data?.message || 'Failed to decrypt message'
      };
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        ...message,
        decrypted_content: 'Failed to decrypt message'
      };
    }
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching messages for conversation:', conversationId);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages');
        return;
      }

      if (data && data.length > 0) {
        console.log(`Found ${data.length} messages, decrypting...`);
        
        // Decrypt messages in batches to avoid overwhelming the edge function
        const batchSize = 5;
        const decryptedMessages: Message[] = [];
        
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const decryptedBatch = await Promise.all(
            batch.map(msg => decryptMessage(msg as Message))
          );
          decryptedMessages.push(...decryptedBatch);
        }
        
        setMessages(decryptedMessages);
        console.log(`Successfully decrypted ${decryptedMessages.length} messages`);
      } else {
        setMessages([]);
        console.log('No messages found for conversation');
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, decryptMessage]);

  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      return;
    }

    fetchMessages();

    // Subscribe to real-time updates for this conversation
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as Message;
          
          // Only decrypt and add if it's not from the current user (they already see their message)
          if (newMessage.sender_id !== user.id) {
            const decryptedMessage = await decryptMessage(newMessage);
            setMessages(prev => [...prev, decryptedMessage]);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Messages channel status for ${conversationId}:`, status);
      });

    return () => {
      console.log(`Cleaning up messages subscription for ${conversationId}`);
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, fetchMessages, decryptMessage]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim() || !user) {
      throw new Error('Missing required parameters for sending message');
    }

    try {
      console.log('Encrypting message...');
      
      // Encrypt the message
      const { data: encryptionData, error: encryptionError } = await supabase.functions.invoke('encryption', {
        body: {
          action: 'encrypt',
          conversationId: conversationId,
          message: content
        }
      });

      if (encryptionError) {
        console.error('Encryption error:', encryptionError);
        throw new Error('Failed to encrypt message');
      }

      const { encrypted, iv } = encryptionData;

      console.log('Saving encrypted message...');
      
      // Save the encrypted message
      const { data: messageData, error: saveError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content_encrypted: encrypted,
          iv: iv
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving message:', saveError);
        throw new Error('Failed to save message');
      }

      // Add the message to local state immediately for the sender
      const newMessage: Message = {
        ...messageData,
        decrypted_content: content
      };
      
      setMessages(prev => [...prev, newMessage]);
      console.log('Message sent successfully');

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [conversationId, user]);

  return { 
    messages, 
    loading, 
    error,
    sendMessage, 
    refetch: fetchMessages 
  };
};
