
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useE2ECrypto } from '@/hooks/useE2ECrypto';
import { fetchPublicKey } from '@/utils/publicKeyManager';
import type { ConversationParticipantWithProfile } from '@/types/supabaseJoins';

export const useGroupChat = (refreshConversations: () => Promise<void>) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { encryptMessage } = useE2ECrypto();

  const createGroupChat = useCallback(async (groupName: string, memberUserIds: string[]) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    console.log('Creating group chat:', { groupName, memberCount: memberUserIds.length });

    try {
      // Create the group conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: groupName,
          is_group: true,
          created_by: user.id,
          session_key_encrypted: 'temp_group_key' // Placeholder for now
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating group conversation:', convError);
        throw new Error('Failed to create group conversation');
      }

      console.log('Group conversation created:', conversation.id);

      // Add all participants (creator + selected members)
      const allParticipants = [user.id, ...memberUserIds];
      const participantInserts = allParticipants.map(userId => ({
        conversation_id: conversation.id,
        user_id: userId
      }));

      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert(participantInserts);

      if (participantError) {
        console.error('Error adding group participants:', participantError);
        
        // Cleanup orphaned conversation
        await supabase
          .from('conversations')
          .delete()
          .eq('id', conversation.id);
          
        throw new Error('Failed to add participants to group');
      }

      console.log(`Added ${allParticipants.length} participants to group`);

      // Refresh conversations to show the new group
      await refreshConversations();

      return conversation.id;

    } catch (error) {
      console.error('Error in createGroupChat:', error);
      throw error;
    }
  }, [user?.id, refreshConversations]);

  const getGroupMembers = useCallback(async (conversationId: string) => {
    try {
      const { data: participants, error } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          profiles(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId);

      if (error) {
        console.error('Error fetching group members:', error);
        return [];
      }

      const typedParticipants = participants as ConversationParticipantWithProfile[] | null;

      return typedParticipants?.map(p => ({
        id: p.user_id,
        name: p.profiles?.full_name || 'Unknown User',
        avatar_url: p.profiles?.avatar_url
      })) || [];
    } catch (error) {
      console.error('Error in getGroupMembers:', error);
      return [];
    }
  }, []);

  return {
    createGroupChat,
    getGroupMembers
  };
};
