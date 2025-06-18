
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useStartChat = (refreshConversations: () => Promise<void>) => {
  const { user } = useAuth();
  const { toast } = useToast();

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
      await refreshConversations();
      
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
  }, [user?.id, refreshConversations, toast]);

  return { startChat };
};
