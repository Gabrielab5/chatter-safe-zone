
import { useEffect, useRef } from 'react';
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

interface UseMessageSubscriptionProps {
  conversationId: string | null;
  onNewMessage: (message: Message) => void;
  onError: (error: string) => void;
}

export const useMessageSubscription = ({ 
  conversationId, 
  onNewMessage, 
  onError 
}: UseMessageSubscriptionProps) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!conversationId || !user) {
      onError(null);
      return;
    }

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
            onNewMessage(newMessage);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Messages channel status for ${conversationId}:`, status);
        
        if (status === 'CHANNEL_ERROR' && mountedRef.current) {
          console.error('Message subscription error');
          onError('Connection lost. Messages may not update in real-time.');
        } else if (status === 'SUBSCRIBED' && mountedRef.current) {
          onError(null);
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
  }, [conversationId, user, onNewMessage, onError]);

  return { mountedRef };
};
