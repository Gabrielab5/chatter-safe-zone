
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

// Union types that handle both success and error cases from Supabase
export type ConversationParticipantQueryResult = ConversationParticipantWithProfile | {
  user_id: string;
  profiles: { error: string };
};

export type UserPresenceQueryResult = UserPresenceWithProfile | {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  profiles: { error: string };
};
