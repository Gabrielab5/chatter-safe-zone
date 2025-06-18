
import { Conversation } from '@/types/chat';

export const getConversationName = (conversation: Conversation): string => {
  if (conversation.is_group) {
    return conversation.name || 'Group Chat';
  }
  return conversation.other_user?.name || 'Direct Message';
};

export const createTimeoutPromise = (timeout: number, errorMessage: string) => {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeout)
  );
};

export const isRLSError = (error: any): boolean => {
  return error?.code === 'PGRST301' || error?.message?.includes('row-level security');
};
