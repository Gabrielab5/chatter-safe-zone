
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log('Fetching conversations for user:', user.id);
      setLoading(true);
      setError(null);

      // Get conversation IDs for this user
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) {
        console.error('Error fetching participants:', participantError);
        setError('Failed to load conversations');
        return;
      }

      if (!participantData || participantData.length === 0) {
        console.log('No conversations found');
        setConversations([]);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);
      console.log('Found conversation IDs:', conversationIds);

      // Get conversation details
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, name, is_group, created_at')
        .in('id', conversationIds)
        .order('created_at', { ascending: false });

      if (conversationError) {
        console.error('Error fetching conversations:', conversationError);
        setError('Failed to load conversations');
        return;
      }

      // Get other participants for direct messages
      const enrichedConversations = await Promise.all(
        (conversationData || []).map(async (conversation) => {
          try {
            if (conversation.is_group) {
              return {
                id: conversation.id,
                name: conversation.name,
                is_group: conversation.is_group,
                created_at: conversation.created_at
              };
            }

            // For direct messages, get the other participant
            const { data: otherParticipants, error: participantsError } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conversation.id)
              .neq('user_id', user.id)
              .limit(1);

            if (participantsError || !otherParticipants || otherParticipants.length === 0) {
              console.error('Error fetching other participants:', participantsError);
              return {
                id: conversation.id,
                name: conversation.name,
                is_group: conversation.is_group,
                created_at: conversation.created_at
              };
            }

            // Get profile info for the other user
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', otherParticipants[0].user_id)
              .single();

            let otherUser = null;
            if (!profileError && profile) {
              otherUser = {
                id: profile.id,
                name: profile.full_name || 'Unknown User',
                avatar_url: profile.avatar_url
              };
            }

            return {
              id: conversation.id,
              name: conversation.name,
              is_group: conversation.is_group,
              created_at: conversation.created_at,
              other_user: otherUser
            };
          } catch (error) {
            console.error('Error enriching conversation:', error);
            return {
              id: conversation.id,
              name: conversation.name,
              is_group: conversation.is_group,
              created_at: conversation.created_at
            };
          }
        })
      );

      console.log('Loaded conversations:', enrichedConversations.length);
      setConversations(enrichedConversations);

    } catch (error) {
      console.error('Error in fetchConversations:', error);
      setError('Failed to load conversations');
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const startChat = useCallback(async (userId: string, userName: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Starting chat with user:', userId);

      // Check if conversation already exists
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingParticipants) {
        for (const participant of existingParticipants) {
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', participant.conversation_id)
            .eq('user_id', userId)
            .single();

          if (otherParticipant) {
            console.log('Existing conversation found:', participant.conversation_id);
            return participant.conversation_id;
          }
        }
      }

      console.log('Creating new conversation...');
      
      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: null,
          is_group: false,
          created_by: user.id,
          session_key_encrypted: 'temp_key'
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw convError;
      }

      // Add participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          {
            conversation_id: conversation.id,
            user_id: user.id
          },
          {
            conversation_id: conversation.id,
            user_id: userId
          }
        ]);

      if (participantError) {
        console.error('Error adding participants:', participantError);
        throw participantError;
      }

      console.log('New conversation created:', conversation.id);
      
      // Refresh conversations list
      await fetchConversations();
      
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
  }, [user?.id, fetchConversations, toast]);

  const getConversationName = useCallback((conversation: Conversation) => {
    if (conversation.is_group) {
      return conversation.name || 'Group Chat';
    }
    return conversation.other_user?.name || 'Direct Message';
  }, []);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    startChat,
    getConversationName
  };
};
