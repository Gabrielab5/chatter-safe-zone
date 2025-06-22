
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Users } from 'lucide-react';
import ConversationsList from './ConversationsList';
import UserSearch from './UserSearch';
import GroupCreationModal from './GroupCreationModal';
import type { UserPresence } from '@/types/userPresence';

interface Conversation {
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

interface ChatTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  conversations: Conversation[];
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  onlineUsers: UserPresence[];
  onStartChat: (userId: string, userName: string) => void;
  onCreateGroup: (groupName: string, selectedUserIds: string[]) => Promise<void>;
  getConversationName: (conversation: Conversation) => string;
  isUserOnline: (userId: string) => boolean;
}

const ChatTabs: React.FC<ChatTabsProps> = ({
  activeTab,
  setActiveTab,
  conversations,
  selectedConversation,
  setSelectedConversation,
  onlineUsers,
  onStartChat,
  onCreateGroup,
  getConversationName,
  isUserOnline
}) => {
  return (
    <div className="w-1/3 border-r bg-muted/50">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="p-4 border-b">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chats" className="flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chats
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chats" className="flex-1 overflow-y-auto m-0">
          <ConversationsList
            conversations={conversations}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            getConversationName={getConversationName}
            isUserOnline={isUserOnline}
          />
        </TabsContent>

        <TabsContent value="users" className="flex-1 overflow-y-auto m-0 p-4 space-y-4">
          <GroupCreationModal 
            onlineUsers={onlineUsers}
            onCreateGroup={onCreateGroup}
          />
          <UserSearch onStartChat={onStartChat} onlineUsers={onlineUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatTabs;
