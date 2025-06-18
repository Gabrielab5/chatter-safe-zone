
import React, { useState } from 'react';
import ChatLayout from '@/components/chat/ChatLayout';
import ChatTabs from '@/components/chat/ChatTabs';
import ChatMessages from '@/components/chat/ChatMessages';
import { useToast } from '@/components/ui/use-toast';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { useChatLogic } from '@/hooks/useChatLogic';

const Chat: React.FC = () => {
  const { toast } = useToast();
  const { onlineUsers } = useUserPresence();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chats');

  const { 
    conversations, 
    loading, 
    startChat, 
    getConversationName 
  } = useChatLogic();

  const { messages, loading: messagesLoading, sendMessage } = useRealTimeMessages(selectedConversation);

  const handleStartChat = async (userId: string, userName: string) => {
    try {
      const conversationId = await startChat(userId, userName);
      setSelectedConversation(conversationId);
      setActiveTab('chats');
    } catch (error) {
      // Error already handled in startChat
    }
  };

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage(content);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
      throw error;
    }
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(u => u.user_id === userId && u.is_online);
  };

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading conversations...</p>
          </div>
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout>
      <div className="flex h-full">
        <ChatTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          conversations={conversations}
          selectedConversation={selectedConversation}
          setSelectedConversation={setSelectedConversation}
          onlineUsers={onlineUsers}
          onStartChat={handleStartChat}
          getConversationName={getConversationName}
          isUserOnline={isUserOnline}
        />

        <ChatMessages
          selectedConversation={selectedConversation}
          conversations={conversations}
          messages={messages}
          messagesLoading={messagesLoading}
          getConversationName={getConversationName}
          onSendMessage={handleSendMessage}
        />
      </div>
    </ChatLayout>
  );
};

export default Chat;
