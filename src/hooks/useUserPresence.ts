
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { UserPresence } from '@/types/userPresence';
import { setUserOnlineStatus, setUserOfflineStatus } from '@/utils/presenceUtils';
import { createPresenceSubscription } from '@/utils/presenceSubscription';
import { createPresenceHeartbeat } from '@/utils/presenceHeartbeat';
import { UserPresenceWithProfile } from '@/types/supabaseJoins';

export const useUserPresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const mountedRef = useRef(true);
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);

  const setUserOnline = useCallback(async (retries = 3) => {
    if (!user?.id || !mountedRef.current) return false;
    return await setUserOnlineStatus(user.id, retries);
  }, [user?.id]);

  const setUserOffline = useCallback(async () => {
    if (!user?.id || isCleaningUpRef.current) return;
    await setUserOfflineStatus(user.id);
  }, [user?.id]);

  const loadInitialUsers = useCallback(async () => {
    if (!user || !mountedRef.current) return;
    
    try {
      // First, try to get user presence with profile join
      const { data: presenceWithProfiles, error: joinError } = await supabase
        .from('user_presence')
        .select(`
          user_id,
          is_online,
          last_seen,
          profiles(
            full_name,
            avatar_url
          )
        `)
        .neq('user_id', user.id);

      // If join query fails, fall back to basic user presence query
      if (joinError) {
        console.log('Join query failed, falling back to basic query:', joinError);
        
        const { data: basicPresence, error: basicError } = await supabase
          .from('user_presence')
          .select('user_id, is_online, last_seen')
          .neq('user_id', user.id);

        if (basicError) {
          console.error('Error fetching basic user presence:', basicError);
          return;
        }

        if (mountedRef.current && basicPresence) {
          const usersWithoutProfiles = basicPresence.map(presence => ({
            user_id: presence.user_id,
            is_online: presence.is_online,
            last_seen: presence.last_seen,
            full_name: undefined,
            avatar_url: undefined
          }));
          
          setOnlineUsers(usersWithoutProfiles);
        }
        return;
      }

      if (mountedRef.current && presenceWithProfiles) {
        // Enhanced type guard to handle both valid profiles and errors
        const isValidPresence = (p: any): p is UserPresenceWithProfile => {
          // Check basic structure
          if (!p || 
              typeof p.user_id !== 'string' || 
              typeof p.is_online !== 'boolean' ||
              typeof p.last_seen !== 'string') {
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
            
            // It's a valid profile object (we don't need to check specific fields since they're optional)
            return true;
          }
          
          return false;
        };

        const validPresenceData = presenceWithProfiles.filter(isValidPresence);
        
        console.log(`Found ${validPresenceData.length} valid presence records out of ${presenceWithProfiles.length} total`);

        const usersWithProfiles = validPresenceData.map(presence => {
          // After filtering with type guard, we can safely access the properties
          return {
            user_id: presence.user_id,
            is_online: presence.is_online,
            last_seen: presence.last_seen,
            full_name: presence.profiles?.full_name || undefined,
            avatar_url: presence.profiles?.avatar_url || undefined
          };
        });
        
        setOnlineUsers(usersWithProfiles);
      }
    } catch (error) {
      console.error('Error loading initial users:', error);
    }
  }, [user]);

  const setupPresenceTracking = useCallback(async () => {
    if (!user?.id || !mountedRef.current) return;

    try {
      console.log('Setting up presence tracking for user:', user.id);
      
      const success = await setUserOnlineStatus(user.id);
      if (!success || !mountedRef.current) {
        console.error('Failed to set initial online status');
        return;
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      channelRef.current = createPresenceSubscription(
        user.id,
        setOnlineUsers,
        mountedRef
      );

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }

      heartbeatRef.current = createPresenceHeartbeat(
        user.id,
        mountedRef,
        isCleaningUpRef
      );

    } catch (error) {
      console.error('Error setting up presence tracking:', error);
    }
  }, [user?.id]);

  const cleanup = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    console.log('Cleaning up presence tracking...');
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.error('Error removing presence channel:', error);
      }
      channelRef.current = null;
    }

    if (user?.id) {
      try {
        await setUserOfflineStatus(user.id);
      } catch (error) {
        console.error('Error setting offline status during cleanup:', error);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;

    if (user?.id) {
      loadInitialUsers();
      setupPresenceTracking();
    } else {
      setOnlineUsers([]);
    }

    const handleBeforeUnload = () => {
      cleanup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('useUserPresence cleanup');
      mountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [user?.id, loadInitialUsers, setupPresenceTracking, cleanup]);

  return { onlineUsers };
};
