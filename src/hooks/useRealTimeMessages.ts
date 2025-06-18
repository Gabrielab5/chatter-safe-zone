
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
  const mountedRef = useRef(true);

  const decryptMessage = useCallback(async (message: Message): Promise<Message> => {
    if (!conversationId || !mountedRef.current) return message;

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Decryption timeout')), 8000)
      );

      const decryptionPromise = supabase.functions.invoke('encryption', {
        body: {
          action: 'decrypt',
          conversationId: conversationId,
          encryptedMessage: message.content_encrypted,
          iv: message.iv
        }
      });

      const { data, error } = await Promise.race([
        decryptionPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Decryption error for message:', message.id, error);
        return {
          ...message,
          decrypted_content: '🔒 Failed to decrypt message'
        };
      }

      return {
        ...message,
        decrypted_content: data?.message || '🔒 Decryption failed'
      };
    } catch (error) {
      console.error('Decryption error for message:', message.id, error);
      return {
        ...message,
        decrypted_content: error.message.includes('timeout') ? '🔒 Decryption timeout' : '🔒 Failed to decrypt message'
      };
    }
  }, [conversationId]);

  // Enhanced batch decryption with better error handling and performance
  const processBatchDecryption = useCallback(async (messagesToDecrypt: Message[]) => {
    if (isDecryptingRef.current || messagesToDecrypt.length === 0 || !mountedRef.current) return;
    
    isDecryptingRef.current = true;
    
    try {
      const batchSize = 3;
      const decryptedMessages: Message[] = [];
      
      for (let i = 0; i < messagesToDecrypt.length; i += batchSize) {
        if (!mountedRef.current) break;
        
        const batch = messagesToDecrypt.slice(i, i + batchSize);
        
        const decryptPromises = batch.map(async (msg) => {
          try {
            return await decryptMessage(msg);
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
      
      if (mountedRef.current) {
        setMessages(decryptedMessages);
        console.log(`Successfully processed ${decryptedMessages.length} messages`);
      }
      
    } finally {
      isDecryptingRef.current = false;
    }
  }, [decryptMessage]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user || !mountedRef.current) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);

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
            setError('Failed to load messages. Please try refreshing.');
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (messageData && messageData.length > 0 && mountedRef.current) {
        console.log(`Found ${messageData.length} messages, starting decryption...`);
        await processBatchDecryption(messageData as Message[]);
      } else if (mountedRef.current) {
        setMessages([]);
        console.log('No messages found for conversation');
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      if (mountedRef.current) {
        setError('Failed to load messages. Please check your connection.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId, user, processBatchDecryption]);

  useEffect(() => {
    mountedRef.current = true;

    if (!conversationId || !user) {
      setMessages([]);
      setError(null);
      return;
    }

    fetchMessages();

    // Enhanced real-time subscription with better error handling
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

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
          if (!mountedRef.current) return;
          
          console.log('New message received:', payload);
          const newMessage = payload.new as Message;
          
          // Only process if it's not from the current user
          if (newMessage.sender_id !== user.id) {
            try {
              const decryptedMessage = await decryptMessage(newMessage);
              
              if (mountedRef.current) {
                setMessages(prev => {
                  const exists = prev.find(msg => msg.id === decryptedMessage.id);
                  if (exists) return prev;
                  return [...prev, decryptedMessage];
                });
              }
            } catch (error) {
              console.error('Error processing new message:', error);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`Messages channel status for ${conversationId}:`, status);
        
        if (status === 'CHANNEL_ERROR' && mountedRef.current) {
          console.error('Message subscription error');
          setError('Connection lost. Messages may not update in real-time.');
        } else if (status === 'SUBSCRIBED' && mountedRef.current) {
          setError(null);
        }
      });

    return () => {
      console.log(`Cleaning up messages subscription for ${conversationId}`);
      mountedRef.current = false;
      
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
    if (!conversationId || !content.trim() || !user || !mountedRef.current) {
      throw new Error('Missing required parameters for sending message');
    }

    try {
      console.log('Encrypting and sending message...');
      
      // Enhanced encryption with timeout and retry logic
      let encryptionData;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries && mountedRef.current) {
        try {
          const encryptionPromise = supabase.functions.invoke('encryption', {
            body: {
              action: 'encrypt',
              conversationId: conversationId,
              message: content
            }
          });
          
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Encryption timeout')), 10000)
          );
          
          const { data, error: encryptionError } = await Promise.race([
            encryptionPromise,
            timeoutPromise
          ]) as any;

          if (encryptionError) {
            throw encryptionError;
          }

          encryptionData = data;
          break;
        } catch (error) {
          retryCount++;
          console.error(`Encryption attempt ${retryCount} failed:`, error);
          
          if (retryCount > maxRetries) {
            throw new Error('Failed to encrypt message after multiple attempts');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!encryptionData || !mountedRef.current) {
        throw new Error('Encryption failed or component unmounted');
      }

      const { encrypted, iv } = encryptionData;

      console.log('Saving encrypted message...');
      
      // Enhanced message saving with retry logic
      let messageData;
      retryCount = 0;
      
      while (retryCount <= maxRetries && mountedRef.current) {
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

      // Add the message to local state immediately for the sender
      const newMessage: Message = {
        ...messageData,
        decrypted_content: content
      };
      
      if (mountedRef.current) {
        setMessages(prev => {
          const exists = prev.find(msg => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
        
        console.log('Message sent and displayed successfully');
      }

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
  }, [conversationId, user]);

  return { 
    messages, 
    loading, 
    error,
    sendMessage, 
    refetch: fetchMessages 
  };
};
