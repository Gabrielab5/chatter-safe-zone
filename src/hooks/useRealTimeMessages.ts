
import { useEffect, useState, useCallback, useRef } from 'react';
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

export const useRealTimeMessages = (conversationId: string | null) => {
  const { user, sessionPrivateKey } = useAuth();
  const { encryptMessage } = useE2ECrypto();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const isDecryptingRef = useRef(false);
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
      
      if (mountedRef.current) {
        setMessages(decryptedMessages);
        console.log(`Successfully processed ${decryptedMessages.length} messages`);
      }
      
    } finally {
      isDecryptingRef.current = false;
    }
  }, [decryptClientMessage]);

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

  // Re-decrypt messages when session key becomes available
  useEffect(() => {
    if (sessionPrivateKey && messages.length > 0) {
      console.log('Session key now available, re-decrypting messages...');
      processBatchDecryption(messages.map(msg => ({
        ...msg,
        decrypted_content: undefined // Reset to trigger re-decryption
      })));
    }
  }, [sessionPrivateKey, processBatchDecryption]);

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
              const decryptedMessage = await decryptClientMessage(newMessage);
              
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
  }, [conversationId, user, fetchMessages, decryptClientMessage]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim() || !user || !mountedRef.current) {
      throw new Error('Missing required parameters for sending message');
    }

    try {
      console.log('Encrypting and sending message using client-side E2EE...');
      
      // Get recipient's user ID
      const recipientUserId = await getRecipientUserId(conversationId);
      
      // Fetch recipient's public key
      const recipientPublicKey = await fetchPublicKey(recipientUserId);
      
      // Encrypt the message using client-side encryption
      const { encryptedMessage, iv } = await encryptMessage(content, recipientPublicKey);
      
      console.log('Message encrypted, saving to database...');
      
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
        
        console.log('Message sent and displayed successfully using client-side E2EE');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error.message.includes('timeout')) {
        throw new Error('Message sending timed out. Please check your connection and try again.');
      } else if (error.message.includes('encrypt')) {
        throw new Error('Failed to encrypt message. Please check your E2EE setup.');
      } else if (error.message.includes('public key')) {
        throw new Error('Failed to find recipient\'s public key. They may need to set up E2EE.');
      } else {
        throw new Error('Failed to send message. Please try again.');
      }
    }
  }, [conversationId, user, getRecipientUserId, encryptMessage]);

  return { 
    messages, 
    loading, 
    error,
    sendMessage, 
    refetch: fetchMessages
  };
};
