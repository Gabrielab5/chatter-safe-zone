
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content_encrypted: string;
  iv: string;
  sender_id: string;
  created_at: string;
  decrypted_content?: string;
}

export const useRealTimeMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    setLoading(true);
    fetchMessages();

    // Subscribe to real-time updates
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
        (payload) => {
          console.log('New message received:', payload);
          decryptAndAddMessage(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const fetchMessages = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        (data || []).map(decryptMessage)
      );

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const decryptMessage = async (message: Message): Promise<Message> => {
    try {
      const response = await supabase.functions.invoke('encryption', {
        body: {
          action: 'decrypt',
          data: message.content_encrypted,
          iv: message.iv,
          conversationId: conversationId
        }
      });

      return {
        ...message,
        decrypted_content: response.data?.result || 'Failed to decrypt'
      };
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        ...message,
        decrypted_content: 'Failed to decrypt'
      };
    }
  };

  const decryptAndAddMessage = async (message: Message) => {
    const decryptedMessage = await decryptMessage(message);
    setMessages(prev => [...prev, decryptedMessage]);
  };

  const sendMessage = async (content: string) => {
    if (!conversationId || !content.trim()) return;

    try {
      // Encrypt message
      const response = await supabase.functions.invoke('encryption', {
        body: {
          action: 'encrypt',
          data: content,
          conversationId: conversationId
        }
      });

      if (response.error) throw response.error;

      const { encrypted, iv } = response.data;

      // Save encrypted message
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: (await supabase.auth.getUser()).data.user?.id,
          content_encrypted: encrypted,
          iv: iv
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  return { messages, loading, sendMessage, refetch: fetchMessages };
};
