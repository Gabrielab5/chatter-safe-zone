
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  content_encrypted: string;
  iv: string;
  sender_id: string;
  created_at: string;
  decrypted_content?: string;
}

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

interface ChatMessagesProps {
  selectedConversation: string | null;
  conversations: Conversation[];
  messages: Message[];
  messagesLoading: boolean;
  getConversationName: (conversation: Conversation) => string;
  onSendMessage: (content: string) => Promise<void>;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  selectedConversation,
  conversations,
  messages,
  messagesLoading,
  getConversationName,
  onSendMessage
}) => {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await onSendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground max-w-md">
          <MessageCircle className="h-16 w-16 mx-auto mb-6 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">Welcome to SecureTalk!</h3>
          <p className="mb-4">Select a conversation to start messaging securely, or find new people to chat with.</p>
          <div className="space-y-2 text-sm">
            <p>🔒 All messages are end-to-end encrypted</p>
            <p>👥 Click "Users" tab to find people to connect with</p>
            <p>💬 Your privacy and security are our top priorities</p>
          </div>
        </div>
      </div>
    );
  }

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b p-4 bg-background">
        <h3 className="font-semibold">
          {currentConversation ? getConversationName(currentConversation) : 'Chat'}
        </h3>
        {currentConversation && !currentConversation.is_group && currentConversation.other_user && (
          <p className="text-sm text-muted-foreground">
            Direct message with {currentConversation.other_user.name}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation by sending a message below</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender_id === user?.id ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender_id === user?.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.decrypted_content || message.content_encrypted}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-4 bg-background">
        <div className="flex space-x-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={!selectedConversation}
          />
          <Button onClick={handleSendMessage} disabled={!newMessage.trim() || !selectedConversation}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatMessages;
