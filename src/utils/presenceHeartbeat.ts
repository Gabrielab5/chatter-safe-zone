
import { supabase } from '@/integrations/supabase/client';

export const createPresenceHeartbeat = (
  userId: string,
  mountedRef: React.MutableRefObject<boolean>,
  isCleaningUpRef: React.MutableRefObject<boolean>
) => {
  let heartbeatFailures = 0;
  const maxFailures = 3;
  
  const intervalId = setInterval(async () => {
    if (isCleaningUpRef.current || !mountedRef.current) return;
    
    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (error) {
        heartbeatFailures++;
        console.error(`Heartbeat failure ${heartbeatFailures}:`, error);
        
        if (heartbeatFailures >= maxFailures) {
          console.error('Max heartbeat failures reached, stopping heartbeat');
          clearInterval(intervalId);
        }
      } else {
        heartbeatFailures = 0;
      }
    } catch (error) {
      heartbeatFailures++;
      console.error(`Heartbeat error ${heartbeatFailures}:`, error);
    }
  }, 30000);

  return intervalId;
};
