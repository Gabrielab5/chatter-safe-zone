import { useEffect, useState, useRef } from 'react';
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

  useEffect(() => {
    // Prevent multiple setups for the same user
    if (!user?.id || setupCompleteRef.current) return;
    
    console.log('Setting up user presence for user:', user.id);
    setupCompleteRef.current = true;

    const setupPresence = async () => {
      try {
        // Set user as online
        const { error: upsertError } = await supabase
          .from('user_presence')
          .upsert({
            user_id: user.id,
            is_online: true,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (upsertError) {
          console.error('Error setting user online:', upsertError);
          return;
        }

        // Fetch initial online users
        const { data: presenceData, error: fetchError } = await supabase
          .from('user_presence')
          .select('user_id, is_online, last_seen');
        
        if (fetchError) {
          console.error('Error fetching online users:', fetchError);
        } else if (presenceData) {
          console.log('Initial online users loaded:', presenceData.length);
          setOnlineUsers(presenceData);
        }

        // Set up real-time subscription
        channelRef.current = supabase
          .channel(`user-presence-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_presence'
            },
            (payload) => {
              console.log('Presence update:', payload.eventType);
              
              // Update state directly instead of refetching
              setOnlineUsers(prev => {
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                  const newData = payload.new as UserPresence;
                  const existingIndex = prev.findIndex(u => u.user_id === newData.user_id);
                  
                  if (existingIndex >= 0) {
                    // Update existing user
                    const updated = [...prev];
                    updated[existingIndex] = newData;
                    return updated;
                  } else {
                    // Add new user
                    return [...prev, newData];
                  }
                } else if (payload.eventType === 'DELETE') {
                  return prev.filter(u => u.user_id !== payload.old.user_id);
                }
                return prev;
              });
            }
          )
          .subscribe((status) => {
            console.log('Presence channel status:', status);
          });

        // Keep user online with heartbeat
        intervalRef.current = setInterval(async () => {
          try {
            await supabase
              .from('user_presence')
              .upsert({
                user_id: user.id,
                is_online: true,
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
          } catch (error) {
            console.error('Heartbeat error:', error);
          }
        }, 30000);

      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    setupPresence();

    // Set user offline on page unload
    const handleBeforeUnload = async () => {
      try {
        await supabase
          .from('user_presence')
          .update({
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error setting user offline:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBeforeUnload();
      } else if (setupCompleteRef.current) {
        // User returned to tab, set online again
        supabase
          .from('user_presence')
          .upsert({
            user_id: user.id,
            is_online: true,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      setupCompleteRef.current = false;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Set user offline and cleanup
      handleBeforeUnload().finally(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      });
    };
  }, [user?.id]);

  return { onlineUsers };
};
