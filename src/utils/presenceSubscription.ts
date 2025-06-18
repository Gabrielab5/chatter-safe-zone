
import { supabase } from '@/integrations/supabase/client';
import type { UserPresence } from '@/types/userPresence';

export const createPresenceSubscription = (
  userId: string,
  onPresenceUpdate: React.Dispatch<React.SetStateAction<UserPresence[]>>,
  mountedRef: React.MutableRefObject<boolean>
) => {
  const channelName = `user-presence-${userId}-${Date.now()}`;
  
  const channel = supabase
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
        
        console.log('Presence update:', payload.eventType, payload.new);
        
        // Optimized state updates to prevent excessive re-renders
        onPresenceUpdate((prev: UserPresence[]) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new as UserPresence;
            if (!newData?.user_id) return prev;
            
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
            const oldData = payload.old as { user_id?: string };
            if (oldData?.user_id) {
              return prev.filter(u => u.user_id !== oldData.user_id);
            }
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
          if (channel && mountedRef.current) {
            channel.subscribe();
          }
        }, 5000);
      }
    });

  return channel;
};
