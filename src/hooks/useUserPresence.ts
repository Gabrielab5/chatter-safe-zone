
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserPresence } from '@/types/userPresence';
import { 
  setUserOnlineStatus, 
  setUserOfflineStatus, 
  fetchInitialOnlineUsers 
} from '@/utils/presenceUtils';
import { createPresenceSubscription } from '@/utils/presenceSubscription';
import { createPresenceHeartbeat } from '@/utils/presenceHeartbeat';

export const useUserPresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const setupCompleteRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const mountedRef = useRef(true);

  const setUserOnline = useCallback(async (retries = 3) => {
    if (!user?.id || !mountedRef.current) return false;
    return await setUserOnlineStatus(user.id, retries);
  }, [user?.id]);

  const setUserOffline = useCallback(async () => {
    if (!user?.id || isCleaningUpRef.current) return;
    await setUserOfflineStatus(user.id);
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!user?.id || setupCompleteRef.current || isCleaningUpRef.current) return;
    
    console.log('Setting up user presence for user:', user.id);
    setupCompleteRef.current = true;

    const setupPresence = async () => {
      try {
        // Set user as online with enhanced retry logic
        const success = await setUserOnline();
        if (!success || !mountedRef.current) {
          console.error('Failed to set user online after retries');
          setupCompleteRef.current = false;
          return;
        }

        // Fetch initial online users
        const initialUsers = await fetchInitialOnlineUsers();
        if (mountedRef.current) {
          setOnlineUsers(initialUsers);
        }

        // Set up real-time subscription
        channelRef.current = createPresenceSubscription(
          user.id,
          setOnlineUsers,
          mountedRef
        );

        // Set up heartbeat
        intervalRef.current = createPresenceHeartbeat(
          user.id,
          mountedRef,
          isCleaningUpRef
        );

      } catch (error) {
        console.error('Error setting up presence:', error);
        setupCompleteRef.current = false;
      }
    };

    setupPresence();

    // Enhanced visibility change handling
    const handleVisibilityChange = async () => {
      if (isCleaningUpRef.current || !mountedRef.current) return;
      
      if (document.hidden) {
        await setUserOffline();
      } else if (setupCompleteRef.current) {
        await setUserOnline();
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', setUserOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    return () => {
      console.log('Cleaning up user presence...');
      mountedRef.current = false;
      isCleaningUpRef.current = true;
      setupCompleteRef.current = false;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      window.removeEventListener('beforeunload', setUserOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Set user offline and cleanup channel
      setUserOffline().finally(() => {
        if (channelRef.current) {
          try {
            supabase.removeChannel(channelRef.current);
          } catch (error) {
            console.error('Error removing presence channel:', error);
          }
          channelRef.current = null;
        }
        isCleaningUpRef.current = false;
      });
    };
  }, [user?.id, setUserOnline, setUserOffline]);

  return { onlineUsers };
};
