
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!user) return;

    // Set user as online when they connect
    const setUserOnline = async () => {
      try {
        // Use upsert with conflict resolution
        const { error } = await supabase.rpc('upsert_user_presence', {
          p_user_id: user.id,
          p_is_online: true,
          p_last_seen: new Date().toISOString()
        });
        
        if (error) {
          console.log('Setting presence via direct table access...');
          // Fallback to direct table access if RPC doesn't exist
          await (supabase as any)
            .from('user_presence')
            .upsert({
              user_id: user.id,
              is_online: true,
              last_seen: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error('Error setting user online:', error);
      }
    };

    setUserOnline();

    // Listen for presence updates
    const channel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          fetchOnlineUsers();
        }
      )
      .subscribe();

    // Fetch initial online users
    const fetchOnlineUsers = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('user_presence')
          .select('user_id, is_online, last_seen');
        
        if (error) {
          console.error('Error fetching online users:', error);
        } else if (data) {
          setOnlineUsers(data);
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    fetchOnlineUsers();

    // Update presence every 30 seconds
    const interval = setInterval(() => {
      setUserOnline();
    }, 30000);

    // Set user offline when they disconnect
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/set-offline', JSON.stringify({ user_id: user.id }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Set user offline
      (supabase as any)
        .from('user_presence')
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .then(() => {
          supabase.removeChannel(channel);
        });
    };
  }, [user]);

  return { onlineUsers };
};
