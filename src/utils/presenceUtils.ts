
import { supabase } from '@/integrations/supabase/client';

export const setUserOnlineStatus = async (userId: string, retries = 3): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const { error: upsertError } = await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
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
    
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
};

export const setUserOfflineStatus = async (userId: string): Promise<void> => {
  try {
    await supabase
      .from('user_presence')
      .update({
        is_online: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    console.log('User presence set as offline');
  } catch (error) {
    console.error('Error setting user offline:', error);
  }
};

export const fetchInitialOnlineUsers = async () => {
  try {
    const { data: presenceData, error: fetchError } = await supabase
      .from('user_presence')
      .select('user_id, is_online, last_seen')
      .order('last_seen', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching online users:', fetchError);
      return [];
    }
    
    console.log('Initial online users loaded:', presenceData?.length || 0);
    return presenceData || [];
  } catch (error) {
    console.error('Unexpected error fetching users:', error);
    return [];
  }
};
