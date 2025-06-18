
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Conversation } from '@/types/chat';
import { createTimeoutPromise, isRLSError } from '@/utils/chatHelpers';

export const useConversations = () => {
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
        if (isRLSError(participantError)) {
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

            const { data: otherParticipants, error: participantsError } = await Promise.race([
              participantPromise,
              createTimeoutPromise(5000, 'Timeout')
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
              createTimeoutPromise(3000, 'Profile timeout')
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

  return {
    conversations,
    loading,
    error,
    fetchConversations
  };
};
