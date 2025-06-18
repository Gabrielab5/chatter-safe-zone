
import { useEffect } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useStartChat } from '@/hooks/useStartChat';
import { getConversationName } from '@/utils/chatHelpers';

export const useChatLogic = () => {
  const { 
    conversations, 
    loading, 
    error, 
    fetchConversations 
  } = useConversations();

  const { startChat } = useStartChat(fetchConversations);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    startChat,
    getConversationName
  };
};
