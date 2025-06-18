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
  const isSetupRef = useRef(false);

  useEffect(() => {
    if (!user || isSetupRef.current) return;
    
    isSetupRef.current = true;
    console.log('Setting up user presence for user:', user.id);

    // Set user as online when they connect
    const setUserOnline = async () => {
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
          console.error('Error setting user online:', error);
        } else {
          console.log('User set as online');
        }
      } catch (error) {
        console.error('Error setting user online:', error);
      }
    };

    // Fetch initial online users
    const fetchOnlineUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('user_presence')
          .select('user_id, is_online, last_seen');
        
        if (error) {
          console.error('Error fetching online users:', error);
        } else if (data) {
          console.log('Online users fetched:', data);
          setOnlineUsers(data);
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    setUserOnline();
    fetchOnlineUsers();

    // Listen for presence updates in real-time (but don't refetch on every update)
    channelRef.current = supabase
      .channel('user-presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          console.log('User presence update received:', payload);
          // Update state directly instead of refetching
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setOnlineUsers(prev => {
              const newData = payload.new as UserPresence;
              const exists = prev.find(u => u.user_id === newData.user_id);
              if (exists) {
                return prev.map(u => u.user_id === newData.user_id ? newData : u);
              } else {
                return [...prev, newData];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            setOnlineUsers(prev => prev.filter(u => u.user_id !== payload.old.user_id));
          }
        }
      )
      .subscribe((status) => {
        console.log('User presence channel status:', status);
      });

    // Update presence every 30 seconds to keep user online
    intervalRef.current = setInterval(() => {
      setUserOnline();
    }, 30000);

    // Set user offline when they disconnect/close tab
    const handleBeforeUnload = async () => {
      await supabase
        .from('user_presence')
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    };

    // Set user offline when page is hidden (tab switching, minimizing)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBeforeUnload();
      } else {
        setUserOnline();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSetupRef.current = false;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Set user offline and cleanup
      handleBeforeUnload().then(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
      });
    };
  }, [user?.id]); // Only depend on user.id to prevent multiple setups

  return { onlineUsers };
};
