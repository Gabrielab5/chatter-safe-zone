
export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  other_user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export interface ChatError {
  message: string;
  code?: string;
  type: 'rls' | 'network' | 'timeout' | 'unknown';
}
