
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  other_user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export const useChatLogic = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            name,
            is_group,
            created_at
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Fetch conversation details with other participants
      const conversationsData = await Promise.all(
        (data || []).map(async (item: any) => {
          const conversation = item.conversations;
          let otherUser = null;

          if (!conversation.is_group) {
            // For direct messages, get the other participant's info
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select(`
                user_id,
                profiles!inner (
                  id,
                  full_name,
                  avatar_url
                )
              `)
              .eq('conversation_id', conversation.id)
              .neq('user_id', user?.id);

            if (participants && participants.length > 0) {
              const profile = participants[0].profiles;
              otherUser = {
                id: profile.id,
                name: profile.full_name || 'Unknown User',
                avatar_url: profile.avatar_url
              };
            }
          }

          return {
            id: conversation.id,
            name: conversation.name,
            is_group: conversation.is_group,
            created_at: conversation.created_at,
            other_user: otherUser
          };
        })
      );

      setConversations(conversationsData);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (userId: string, userName: string) => {
    try {
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            is_group
          )
        `)
        .eq('user_id', user?.id);

      const directMessage = existingConversation?.find((conv: any) => {
        return !conv.conversations.is_group;
      });

      if (directMessage) {
        // Check if the other user is in this conversation
        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', directMessage.conversation_id)
          .eq('user_id', userId)
          .single();

        if (otherParticipant) {
          return directMessage.conversation_id;
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: null,
          is_group: false,
          created_by: user?.id,
          session_key_encrypted: 'temp_key'
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          {
            conversation_id: conversation.id,
            user_id: user?.id
          },
          {
            conversation_id: conversation.id,
            user_id: userId
          }
        ]);

      if (participantError) throw participantError;

      fetchConversations();
      
      toast({
        title: "Success",
        description: `Started chat with ${userName}`
      });

      return conversation.id;
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: "Error",
        description: "Failed to start chat",
        variant: "destructive"
      });
      throw error;
    }
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.is_group) {
      return conversation.name || 'Group Chat';
    }
    return conversation.other_user?.name || 'Direct Message';
  };

  return {
    conversations,
    loading,
    fetchConversations,
    startChat,
    getConversationName
  };
};
