
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Search, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface User {
  id: string;
  email: string;
  full_name: string;
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
        .select('id, email, full_name, avatar_url')
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
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
        .select('id, email, full_name, avatar_url')
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

  const onlineUsersList = users.filter(user => isUserOnline(user.id));
  const offlineUsersList = users.filter(user => !isUserOnline(user.id));

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

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Searching users...</p>
          </div>
        ) : users.length > 0 ? (
          <>
            {onlineUsersList.length > 0 && (
              <div>
                <div className="flex items-center text-sm font-medium text-muted-foreground mb-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                  Online ({onlineUsersList.length})
                </div>
                <div className="space-y-2">
                  {onlineUsersList.map((user) => (
                    <UserItem 
                      key={user.id} 
                      user={user} 
                      isOnline={true} 
                      onStartChat={onStartChat} 
                    />
                  ))}
                </div>
              </div>
            )}

            {offlineUsersList.length > 0 && (
              <div>
                <div className="flex items-center text-sm font-medium text-muted-foreground mb-2">
                  <div className="h-2 w-2 bg-gray-400 rounded-full mr-2"></div>
                  Offline ({offlineUsersList.length})
                </div>
                <div className="space-y-2">
                  {offlineUsersList.map((user) => (
                    <UserItem 
                      key={user.id} 
                      user={user} 
                      isOnline={false} 
                      onStartChat={onStartChat} 
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">No users found</p>
            <p className="text-sm">Try a different search term or check back later</p>
          </div>
        )}
      </div>
    </div>
  );
};

const UserItem: React.FC<{
  user: User;
  isOnline: boolean;
  onStartChat: (userId: string, userName: string) => void;
}> = ({ user, isOnline, onStartChat }) => {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name || user.email} />
            ) : (
              <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium">
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </div>
            )}
          </Avatar>
          <div
            className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          />
        </div>
        <div>
          <p className="font-medium">{user.full_name || 'Unknown User'}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => onStartChat(user.id, user.full_name || user.email)}
        className="shrink-0"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Chat
      </Button>
    </div>
  );
};

export default UserSearch;
