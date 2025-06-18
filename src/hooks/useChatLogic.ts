
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
      console.log('Fetching conversations for user:', user?.id);
      
      // First get conversation IDs for this user
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (participantError) {
        console.error('Error fetching conversation participants:', participantError);
        throw participantError;
      }

      if (!participantData || participantData.length === 0) {
        console.log('No conversations found for user');
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      // Then get conversation details
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, name, is_group, created_at')
        .in('id', conversationIds);

      if (conversationError) {
        console.error('Error fetching conversations:', conversationError);
        throw conversationError;
      }

      // Get conversation details with other participants
      const conversationsData = await Promise.all(
        (conversationData || []).map(async (conversation: any) => {
          let otherUser = null;

          if (!conversation.is_group) {
            // For direct messages, get the other participant's info
            const { data: participants, error: participantsError } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conversation.id)
              .neq('user_id', user?.id);

            if (participantsError) {
              console.error('Error fetching participants:', participantsError);
            } else if (participants && participants.length > 0) {
              // Get profile info for the other user
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', participants[0].user_id)
                .single();

              if (profileError) {
                console.error('Error fetching profile:', profileError);
              } else if (profile) {
                otherUser = {
                  id: profile.id,
                  name: profile.full_name || 'Unknown User',
                  avatar_url: profile.avatar_url
                };
              }
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
      // Check if conversation already exists between these two users
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (existingParticipants) {
        for (const participant of existingParticipants) {
          // Check if the other user is also in this conversation
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', participant.conversation_id)
            .eq('user_id', userId)
            .single();

          if (otherParticipant) {
            // Conversation already exists
            return participant.conversation_id;
          }
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
