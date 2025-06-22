
import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { MessageCircle, Users } from 'lucide-react';

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
          <p className="text-sm">Switch to the Users tab to start chatting with people or create a group</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {conversations.map((conversation) => {
        const conversationName = getConversationName(conversation);
        const isOnline = !conversation.is_group && conversation.other_user 
          ? isUserOnline(conversation.other_user.id)
          : false;

        return (
          <div
            key={conversation.id}
            className={`p-3 cursor-pointer hover:bg-muted rounded-lg transition-colors ${
              selectedConversation === conversation.id ? 'bg-muted' : ''
            }`}
            onClick={() => setSelectedConversation(conversation.id)}
          >
            <div className="flex items-center">
              <div className="relative">
                {conversation.is_group ? (
                  <div className="h-10 w-10 mr-3 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                ) : (
                  <Avatar className="h-10 w-10 mr-3">
                    {conversation.other_user?.avatar_url ? (
                      <img src={conversation.other_user.avatar_url} alt={conversationName} />
                    ) : (
                      <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium">
                        {conversationName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Avatar>
                )}
                
                {!conversation.is_group && conversation.other_user && (
                  <div
                    className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${
                      isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{conversationName}</p>
                  {conversation.is_group && (
                    <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {conversation.is_group 
                    ? 'Group Chat' 
                    : isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationsList;
