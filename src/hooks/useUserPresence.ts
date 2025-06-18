
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
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
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
      const { data } = await supabase
        .from('user_presence')
        .select('user_id, is_online, last_seen');
      
      if (data) {
        setOnlineUsers(data);
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
      supabase
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
