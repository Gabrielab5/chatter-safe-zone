
import { useEffect, useState, useCallback, useRef } from 'react';
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
  const channelRef = useRef<any>(null);
  const isDecryptingRef = useRef(false);
  const decryptionQueueRef = useRef<Message[]>([]);

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
          decrypted_content: '🔒 Failed to decrypt message'
        };
      }

      return {
        ...message,
        decrypted_content: data?.message || '🔒 Failed to decrypt message'
      };
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        ...message,
        decrypted_content: '🔒 Failed to decrypt message'
      };
    }
  }, [conversationId]);

  // Optimized batch decryption with queue management
  const processBatchDecryption = useCallback(async (messagesToDecrypt: Message[]) => {
    if (isDecryptingRef.current || messagesToDecrypt.length === 0) return;
    
    isDecryptingRef.current = true;
    
    try {
      const batchSize = 3; // Reduced batch size for better responsiveness
      const decryptedMessages: Message[] = [];
      
      for (let i = 0; i < messagesToDecrypt.length; i += batchSize) {
        const batch = messagesToDecrypt.slice(i, i + batchSize);
        
        // Process batch with timeout protection
        const decryptPromises = batch.map(async (msg) => {
          return Promise.race([
            decryptMessage(msg),
            new Promise<Message>((_, reject) => 
              setTimeout(() => reject(new Error('Decryption timeout')), 10000)
            )
          ]);
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
                decrypted_content: '🔒 Decryption timeout'
              });
            }
          });
          
          // Add small delay between batches to prevent overwhelming
          if (i + batchSize < messagesToDecrypt.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error('Batch decryption error:', error);
          // Add failed messages with error content
          batch.forEach(msg => {
            decryptedMessages.push({
              ...msg,
              decrypted_content: '🔒 Decryption failed'
            });
          });
        }
      }
      
      setMessages(decryptedMessages);
      console.log(`Successfully processed ${decryptedMessages.length} messages`);
      
    } finally {
      isDecryptingRef.current = false;
    }
  }, [decryptMessage]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching messages for conversation:', conversationId);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50); // Add reasonable limit for performance

      if (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages. Please try again.');
        return;
      }

      if (data && data.length > 0) {
        console.log(`Found ${data.length} messages, starting decryption...`);
        await processBatchDecryption(data as Message[]);
      } else {
        setMessages([]);
        console.log('No messages found for conversation');
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setError('Failed to load messages. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, processBatchDecryption]);

  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      setError(null);
      return;
    }

    fetchMessages();

    // Clean up existing channel before creating new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Subscribe to real-time updates with improved error handling
    const channelName = `messages-${conversationId}-${Date.now()}`;
    channelRef.current = supabase
      .channel(channelName)
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
          
          // Only decrypt and add if it's not from the current user
          if (newMessage.sender_id !== user.id) {
            try {
              const decryptedMessage = await decryptMessage(newMessage);
              setMessages(prev => {
                // Prevent duplicate messages
                const exists = prev.find(msg => msg.id === decryptedMessage.id);
                if (exists) return prev;
                return [...prev, decryptedMessage];
              });
            } catch (error) {
              console.error('Error processing new message:', error);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`Messages channel status for ${conversationId}:`, status);
        
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('Message subscription error');
          setError('Connection lost. Messages may not update in real-time.');
        } else if (status === 'SUBSCRIBED') {
          setError(null); // Clear error when reconnected
        }
      });

    return () => {
      console.log(`Cleaning up messages subscription for ${conversationId}`);
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.error('Error removing message channel:', error);
        }
        channelRef.current = null;
      }
    };
  }, [conversationId, user, fetchMessages, decryptMessage]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim() || !user) {
      throw new Error('Missing required parameters for sending message');
    }

    try {
      console.log('Encrypting and sending message...');
      
      // Encrypt the message with timeout protection
      const encryptionPromise = supabase.functions.invoke('encryption', {
        body: {
          action: 'encrypt',
          conversationId: conversationId,
          message: content
        }
      });
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Encryption timeout')), 15000)
      );
      
      const { data: encryptionData, error: encryptionError } = await Promise.race([
        encryptionPromise,
        timeoutPromise
      ]) as any;

      if (encryptionError) {
        console.error('Encryption error:', encryptionError);
        throw new Error('Failed to encrypt message. Please try again.');
      }

      const { encrypted, iv } = encryptionData;

      console.log('Saving encrypted message...');
      
      // Save the encrypted message with retry logic
      let saveAttempts = 0;
      const maxSaveAttempts = 3;
      let messageData;
      
      while (saveAttempts < maxSaveAttempts) {
        try {
          const { data, error: saveError } = await supabase
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
            throw saveError;
          }
          
          messageData = data;
          break;
        } catch (error) {
          saveAttempts++;
          console.error(`Save attempt ${saveAttempts} failed:`, error);
          
          if (saveAttempts >= maxSaveAttempts) {
            throw new Error('Failed to save message after multiple attempts');
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Add the message to local state immediately for the sender
      const newMessage: Message = {
        ...messageData,
        decrypted_content: content
      };
      
      setMessages(prev => {
        // Prevent duplicates
        const exists = prev.find(msg => msg.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
      
      console.log('Message sent and displayed successfully');

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Provide user-friendly error messages
      if (error.message.includes('timeout')) {
        throw new Error('Message sending timed out. Please check your connection and try again.');
      } else if (error.message.includes('encrypt')) {
        throw new Error('Failed to encrypt message. Please try again.');
      } else {
        throw new Error('Failed to send message. Please try again.');
      }
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
