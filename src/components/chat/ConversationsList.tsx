
import React from 'react';
import { Avatar } from '@/components/ui/avatar';

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
  return (
    <div className="space-y-1">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`p-4 cursor-pointer hover:bg-muted ${
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
                    {getConversationName(conversation).charAt(0)}
                  </div>
                )}
              </Avatar>
              {!conversation.is_group && conversation.other_user && (
                <div
                  className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${
                    isUserOnline(conversation.other_user.id) ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{getConversationName(conversation)}</p>
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
