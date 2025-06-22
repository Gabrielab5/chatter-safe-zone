
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useE2ECrypto } from '@/hooks/useE2ECrypto';
import { fetchPublicKey } from '@/utils/publicKeyManager';

// Define a proper type for the joined query result
interface ParticipantWithProfile {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

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
      // First, try to get participants with profile join
      const { data: participantsWithProfiles, error: joinError } = await supabase
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

      // If join query fails, fall back to basic participants query
      if (joinError) {
        console.log('Join query failed, falling back to basic query:', joinError);
        
        const { data: basicParticipants, error: basicError } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId);

        if (basicError) {
          console.error('Error fetching basic participants:', basicError);
          return [];
        }

        if (!basicParticipants || !Array.isArray(basicParticipants)) {
          return [];
        }

        // Return basic participant data without profiles
        return basicParticipants.map(p => ({
          id: p.user_id,
          name: 'Unknown User',
          avatar_url: undefined
        }));
      }

      if (!participantsWithProfiles || !Array.isArray(participantsWithProfiles)) {
        console.log('No participants data found');
        return [];
      }

      // Enhanced type guard to handle both valid profiles and errors
      const isValidParticipant = (p: any): p is ParticipantWithProfile => {
        // Check if it's a basic participant structure
        if (!p || typeof p.user_id !== 'string') {
          return false;
        }
        
        // If profiles is null, that's valid (user might not have profile)
        if (p.profiles === null) {
          return true;
        }
        
        // If profiles is an object, check if it's a valid profile or an error
        if (typeof p.profiles === 'object' && p.profiles !== null) {
          // Check for error indicators (SelectQueryError has specific properties)
          if ('error' in p.profiles || 'message' in p.profiles || 'code' in p.profiles || 'details' in p.profiles) {
            console.log('Profile query error for user:', p.user_id, p.profiles);
            return false;
          }
          
          // Check if it has the basic profile structure
          if (typeof p.profiles.id === 'string') {
            return true;
          }
        }
        
        return false;
      };

      const validParticipants = participantsWithProfiles.filter(isValidParticipant);
      
      console.log(`Found ${validParticipants.length} valid participants out of ${participantsWithProfiles.length} total`);

      return validParticipants.map(p => {
        // TypeScript now knows p is ParticipantWithProfile due to the type guard
        const profile = p.profiles;
        return {
          id: p.user_id,
          name: profile?.full_name || 'Unknown User',
          avatar_url: profile?.avatar_url || undefined
        };
      });
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
