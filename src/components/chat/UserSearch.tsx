
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Search, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface User {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
}

interface UserPresence {
  user_id: string;
  is_online: boolean;
}

interface UserSearchProps {
  onStartChat: (userId: string, userName: string) => void;
  onlineUsers: UserPresence[];
}

const UserSearch: React.FC<UserSearchProps> = ({ onStartChat, onlineUsers }) => {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchTerm.trim()) {
      searchUsers();
    } else {
      fetchAllUsers();
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, display_name, avatar_url')
        .or(`full_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .neq('id', currentUser?.id)
        .limit(20);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, display_name, avatar_url')
        .neq('id', currentUser?.id)
        .limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(u => u.user_id === userId && u.is_online);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : users.length > 0 ? (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 hover:bg-muted rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name || user.full_name} />
                    ) : (
                      <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium">
                        {(user.display_name || user.full_name || user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Avatar>
                  <div
                    className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${
                      isUserOnline(user.id) ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                </div>
                <div>
                  <p className="font-medium">{user.display_name || user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {isUserOnline(user.id) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => onStartChat(user.id, user.display_name || user.full_name)}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No users found
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSearch;
