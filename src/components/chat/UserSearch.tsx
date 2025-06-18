
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Search, MessageCircle, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [error, setError] = useState<string | null>(null);
  const [startingChats, setStartingChats] = useState<Set<string>>(new Set());

  // Memoized user filtering and sorting
  const { onlineUsersList, offlineUsersList, filteredUsers } = useMemo(() => {
    const filtered = searchTerm.trim() 
      ? users.filter(user => 
          user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : users;

    const isUserOnline = (userId: string) => 
      onlineUsers.some(u => u.user_id === userId && u.is_online);

    const online = filtered.filter(user => isUserOnline(user.id))
      .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
    
    const offline = filtered.filter(user => !isUserOnline(user.id))
      .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));

    return {
      onlineUsersList: online,
      offlineUsersList: offline,
      filteredUsers: filtered
    };
  }, [users, searchTerm, onlineUsers]);

  const fetchUsers = async (search?: string) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .neq('id', currentUser?.id);

      if (search?.trim()) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query
        .order('full_name', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users. Please try again.');
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Unexpected error fetching users:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        fetchUsers(searchTerm);
      } else {
        fetchUsers();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleStartChat = async (userId: string, userName: string) => {
    if (startingChats.has(userId)) return;

    setStartingChats(prev => new Set(prev).add(userId));
    
    try {
      await onStartChat(userId, userName);
    } catch (error) {
      console.error('Failed to start chat:', error);
      setError(`Failed to start chat with ${userName}. Please try again.`);
    } finally {
      setStartingChats(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const isUserOnline = (userId: string) => 
    onlineUsers.some(u => u.user_id === userId && u.is_online);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Search Input */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="flex-shrink-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Users List */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading users...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <>
            {/* Online Users Section */}
            {onlineUsersList.length > 0 && (
              <div>
                <div className="flex items-center text-sm font-medium text-muted-foreground mb-3 px-1">
                  <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  Online ({onlineUsersList.length})
                </div>
                <div className="space-y-2">
                  {onlineUsersList.map((user) => (
                    <UserItem 
                      key={user.id} 
                      user={user} 
                      isOnline={true} 
                      onStartChat={handleStartChat}
                      isStartingChat={startingChats.has(user.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Offline Users Section */}
            {offlineUsersList.length > 0 && (
              <div>
                <div className="flex items-center text-sm font-medium text-muted-foreground mb-3 px-1">
                  <div className="h-2 w-2 bg-gray-400 rounded-full mr-2"></div>
                  Offline ({offlineUsersList.length})
                </div>
                <div className="space-y-2">
                  {offlineUsersList.map((user) => (
                    <UserItem 
                      key={user.id} 
                      user={user} 
                      isOnline={false} 
                      onStartChat={handleStartChat}
                      isStartingChat={startingChats.has(user.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">No users found</p>
            <p className="text-sm">
              {searchTerm ? 'Try a different search term' : 'No users available'}
            </p>
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
  isStartingChat: boolean;
}> = ({ user, isOnline, onStartChat, isStartingChat }) => {
  const displayName = user.full_name || 'Unknown User';
  
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-all duration-200 group">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium text-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </Avatar>
          <div
            className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background transition-colors ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{displayName}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {isOnline ? '🟢 Online' : '⚫ Offline'}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => onStartChat(user.id, displayName)}
        disabled={isStartingChat}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {isStartingChat ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        ) : (
          <>
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat
          </>
        )}
      </Button>
    </div>
  );
};

export default UserSearch;
