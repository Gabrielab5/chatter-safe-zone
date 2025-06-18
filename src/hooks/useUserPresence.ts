
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

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

    for (let i = 0; i < retries; i++) {
      try {
        const { error: upsertError } = await supabase
          .from('user_presence')
          .upsert({
            user_id: user.id,
            is_online: true,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (!upsertError) {
          console.log('User presence set as online');
          return true;
        }
        console.error(`Presence update attempt ${i + 1} failed:`, upsertError);
      } catch (error) {
        console.error(`Presence update attempt ${i + 1} error:`, error);
      }
      
      if (i < retries - 1 && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return false;
  }, [user?.id]);

  const setUserOffline = useCallback(async () => {
    if (!user?.id || isCleaningUpRef.current) return;
    
    try {
      // Use navigator.sendBeacon for more reliable offline updates
      const data = JSON.stringify({
        user_id: user.id,
        is_online: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Try beacon first, fallback to regular update
      const beaconSent = navigator.sendBeacon && 
        navigator.sendBeacon('/api/user-offline', data);
      
      if (!beaconSent) {
        await supabase
          .from('user_presence')
          .update({
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      }
      
      console.log('User presence set as offline');
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
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

        // Fetch initial online users with proper error handling
        try {
          const { data: presenceData, error: fetchError } = await supabase
            .from('user_presence')
            .select('user_id, is_online, last_seen')
            .order('last_seen', { ascending: false });
          
          if (fetchError) {
            console.error('Error fetching online users:', fetchError);
          } else if (presenceData && mountedRef.current) {
            console.log('Initial online users loaded:', presenceData.length);
            setOnlineUsers(presenceData);
          }
        } catch (error) {
          console.error('Unexpected error fetching users:', error);
        }

        // Set up real-time subscription with enhanced error handling
        const channelName = `user-presence-${user.id}-${Date.now()}`;
        channelRef.current = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_presence'
            },
            (payload) => {
              if (!mountedRef.current) return;
              
              console.log('Presence update:', payload.eventType, payload.new?.user_id);
              
              // Optimized state updates to prevent excessive re-renders
              setOnlineUsers(prev => {
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                  const newData = payload.new as UserPresence;
                  const existingIndex = prev.findIndex(u => u.user_id === newData.user_id);
                  
                  if (existingIndex >= 0) {
                    const existing = prev[existingIndex];
                    if (existing.is_online !== newData.is_online || 
                        existing.last_seen !== newData.last_seen) {
                      const updated = [...prev];
                      updated[existingIndex] = newData;
                      return updated;
                    }
                    return prev;
                  } else {
                    return [...prev, newData];
                  }
                } else if (payload.eventType === 'DELETE') {
                  return prev.filter(u => u.user_id !== payload.old?.user_id);
                }
                return prev;
              });
            }
          )
          .subscribe((status) => {
            console.log('Presence channel status:', status);
            if (status === 'CHANNEL_ERROR' && mountedRef.current) {
              console.error('Presence subscription error, attempting reconnect...');
              setTimeout(() => {
                if (channelRef.current && !isCleaningUpRef.current && mountedRef.current) {
                  channelRef.current.subscribe();
                }
              }, 5000);
            }
          });

        // Enhanced heartbeat with exponential backoff on failure
        let heartbeatFailures = 0;
        const maxFailures = 3;
        
        intervalRef.current = setInterval(async () => {
          if (isCleaningUpRef.current || !mountedRef.current) return;
          
          try {
            const { error } = await supabase
              .from('user_presence')
              .upsert({
                user_id: user.id,
                is_online: true,
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
            if (error) {
              heartbeatFailures++;
              console.error(`Heartbeat failure ${heartbeatFailures}:`, error);
              
              if (heartbeatFailures >= maxFailures) {
                console.error('Max heartbeat failures reached, stopping heartbeat');
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }
              }
            } else {
              heartbeatFailures = 0;
            }
          } catch (error) {
            heartbeatFailures++;
            console.error(`Heartbeat error ${heartbeatFailures}:`, error);
          }
        }, 30000);

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

    // Add event listeners with passive option for better performance
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
