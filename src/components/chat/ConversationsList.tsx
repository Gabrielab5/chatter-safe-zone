
import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { MessageCircle } from 'lucide-react';

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

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  getConversationName: (conversation: Conversation) => string;
  isUserOnline: (userId: string) => boolean;
}

const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
  selectedConversation,
  setSelectedConversation,
  getConversationName,
  isUserOnline
}) => {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium mb-2">No conversations yet</p>
          <p className="text-sm">Switch to the Users tab to start chatting with people</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`p-3 cursor-pointer hover:bg-muted rounded-lg transition-colors ${
            selectedConversation === conversation.id ? 'bg-muted' : ''
          }`}
          onClick={() => setSelectedConversation(conversation.id)}
        >
          <div className="flex items-center">
            <div className="relative">
              <Avatar className="h-10 w-10 mr-3">
                {conversation.other_user?.avatar_url ? (
                  <img src={conversation.other_user.avatar_url} alt={getConversationName(conversation)} />
                ) : (
                  <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium">
                    {getConversationName(conversation).charAt(0).toUpperCase()}
                  </div>
                )}
              </Avatar>
              {!conversation.is_group && conversation.other_user && (
                <div
                  className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${
                    isUserOnline(conversation.other_user.id) ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                  title={isUserOnline(conversation.other_user.id) ? 'Online' : 'Offline'}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{getConversationName(conversation)}</p>
              <p className="text-sm text-muted-foreground">
                {conversation.is_group ? 'Group Chat' : 
                 isUserOnline(conversation.other_user?.id || '') ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationsList;
