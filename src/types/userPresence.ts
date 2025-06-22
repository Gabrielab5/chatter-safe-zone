
export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  full_name?: string;
  avatar_url?: string;
}
