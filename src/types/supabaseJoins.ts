
// Types for Supabase query responses with joins
export interface ConversationParticipantWithProfile {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface UserPresenceWithProfile {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}
