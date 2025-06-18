
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
    if (!user?.id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching conversations for user:', user.id);
      setLoading(true);
      setError(null);

      // Get conversation IDs for this user with improved error handling
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) {
        console.error('Error fetching participants:', participantError);
        
        // Check if it's an RLS error
        if (participantError.code === 'PGRST301' || participantError.message?.includes('row-level security')) {
          setError('Authentication required to access conversations');
          toast({
            title: "Authentication Error",
            description: "Please log out and log back in to access your conversations",
            variant: "destructive"
          });
        } else {
          setError('Failed to load conversations');
          toast({
            title: "Error",
            description: "Failed to load conversations. Please check your connection.",
            variant: "destructive"
          });
        }
        return;
      }

      if (!participantData || participantData.length === 0) {
        console.log('No conversations found');
        setConversations([]);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);
      console.log('Found conversation IDs:', conversationIds);

      // Get conversation details with better error handling
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, name, is_group, created_at')
        .in('id', conversationIds)
        .order('created_at', { ascending: false });

      if (conversationError) {
        console.error('Error fetching conversations:', conversationError);
        setError('Failed to load conversation details');
        toast({
          title: "Error",
          description: "Failed to load conversation details",
          variant: "destructive"
        });
        return;
      }

      // Get other participants for direct messages with timeout protection
      const enrichedConversations = await Promise.allSettled(
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

            // For direct messages, get the other participant with timeout
            const participantPromise = supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conversation.id)
              .neq('user_id', user.id)
              .limit(1);

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            );

            const { data: otherParticipants, error: participantsError } = await Promise.race([
              participantPromise,
              timeoutPromise
            ]) as any;

            if (participantsError || !otherParticipants || otherParticipants.length === 0) {
              console.warn('Could not fetch other participants for conversation:', conversation.id);
              return {
                id: conversation.id,
                name: conversation.name,
                is_group: conversation.is_group,
                created_at: conversation.created_at
              };
            }

            // Get profile info for the other user with timeout
            const profilePromise = supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', otherParticipants[0].user_id)
              .single();

            const { data: profile, error: profileError } = await Promise.race([
              profilePromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Profile timeout')), 3000))
            ]) as any;

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

      // Filter successful results
      const validConversations = enrichedConversations
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value);

      console.log('Loaded conversations:', validConversations.length);
      setConversations(validConversations);

      // Log any failed enrichments
      const failedCount = enrichedConversations.filter(result => result.status === 'rejected').length;
      if (failedCount > 0) {
        console.warn(`Failed to enrich ${failedCount} conversations`);
      }

    } catch (error) {
      console.error('Error in fetchConversations:', error);
      setError('Failed to load conversations');
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading conversations",
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

      // Check if conversation already exists with improved logic
      const { data: existingParticipants, error: searchError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (searchError) {
        console.error('Error searching for existing conversations:', searchError);
        throw new Error('Failed to check for existing conversations');
      }

      if (existingParticipants) {
        for (const participant of existingParticipants) {
          const { data: otherParticipant, error: checkError } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', participant.conversation_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (checkError) {
            console.warn('Error checking participant:', checkError);
            continue;
          }

          if (otherParticipant) {
            console.log('Existing conversation found:', participant.conversation_id);
            return participant.conversation_id;
          }
        }
      }

      console.log('Creating new conversation...');
      
      // Create new conversation with better error handling
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
        throw new Error('Failed to create conversation');
      }

      // Add participants with transaction-like behavior
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
        
        // Attempt cleanup of orphaned conversation
        await supabase
          .from('conversations')
          .delete()
          .eq('id', conversation.id);
          
        throw new Error('Failed to add participants to conversation');
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
        description: error instanceof Error ? error.message : "Failed to start chat",
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
