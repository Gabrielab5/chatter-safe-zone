
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageDecryption } from './useMessageDecryption';
import { useMessageSending } from './useMessageSending';
import { useMessageSubscription } from './useMessageSubscription';
import { useMessageFetching } from './useMessageFetching';

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

  const { processBatchDecryption, mountedRef: decryptionMountedRef } = useMessageDecryption();
  const { sendMessage: sendMessageInternal, mountedRef: sendingMountedRef } = useMessageSending(conversationId);
  const { fetchMessages } = useMessageFetching();

  const handleNewMessage = useCallback(async (newMessage: Message) => {
    try {
      const decryptedMessage = await processBatchDecryption([newMessage]);
      
      if (decryptionMountedRef.current) {
        setMessages(prev => {
          const exists = prev.find(msg => msg.id === decryptedMessage[0].id);
          if (exists) return prev;
          return [...prev, decryptedMessage[0]];
        });
      }
    } catch (error) {
      console.error('Error processing new message:', error);
    }
  }, [processBatchDecryption, decryptionMountedRef]);

  const handleSubscriptionError = useCallback((errorMessage: string | null) => {
    setError(errorMessage);
  }, []);

  // Set up real-time subscription
  useMessageSubscription({
    conversationId,
    onNewMessage: handleNewMessage,
    onError: handleSubscriptionError
  });

  const loadMessages = useCallback(async () => {
    if (!conversationId || !decryptionMountedRef.current) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedMessages = await fetchMessages(conversationId);
      
      if (fetchedMessages.length > 0 && decryptionMountedRef.current) {
        console.log(`Found ${fetchedMessages.length} messages, starting decryption...`);
        const decryptedMessages = await processBatchDecryption(fetchedMessages);
        
        if (decryptionMountedRef.current) {
          setMessages(decryptedMessages);
        }
      } else if (decryptionMountedRef.current) {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error in loadMessages:', error);
      if (decryptionMountedRef.current) {
        setError('Failed to load messages. Please check your connection.');
      }
    } finally {
      if (decryptionMountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId, fetchMessages, processBatchDecryption, decryptionMountedRef]);

  // Load messages when conversation changes
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const sendMessage = useCallback(async (content: string) => {
    try {
      const newMessage = await sendMessageInternal(content);
      
      if (sendingMountedRef.current) {
        setMessages(prev => {
          const exists = prev.find(msg => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [sendMessageInternal, sendingMountedRef]);

  return { 
    messages, 
    loading, 
    error,
    sendMessage, 
    refetch: loadMessages
  };
};
