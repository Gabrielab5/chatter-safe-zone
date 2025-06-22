
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { UserPresence } from '@/types/userPresence';
import type { UserPresenceWithProfile } from '@/types/supabaseJoins';
import { setUserOnlineStatus, setUserOfflineStatus } from '@/utils/presenceUtils';
import { createPresenceSubscription } from '@/utils/presenceSubscription';
import { createPresenceHeartbeat } from '@/utils/presenceHeartbeat';

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
      const { data, error } = await supabase
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

      if (error) {
        console.error('Error fetching initial users:', error);
        return;
      }

      if (mountedRef.current) {
        const typedData = data as UserPresenceWithProfile[] | null;
        const usersWithProfiles = typedData?.map(presence => ({
          user_id: presence.user_id,
          is_online: presence.is_online,
          last_seen: presence.last_seen,
          full_name: presence.profiles?.full_name,
          avatar_url: presence.profiles?.avatar_url
        })) || [];
        
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
