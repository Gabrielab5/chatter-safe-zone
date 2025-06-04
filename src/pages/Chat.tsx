
import React, { useState, useEffect } from "react";
import ChatLayout from "@/components/chat/ChatLayout";
import ConversationList from "@/components/chat/ConversationList";
import MessageArea from "@/components/chat/MessageArea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  lastMessage?: string;
  time?: string;
  unread?: number;
  participants?: any[];
}

interface Message {
  id: string;
  content: string;
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read: boolean;
  senderId: string;
}

const Chat: React.FC = () => {
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [showConversations, setShowConversations] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isMobile) {
      setShowConversations(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

  const loadConversations = async () => {
    try {
      const { data: participantData, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            name,
            is_group,
            created_at,
            conversation_participants (
              user_id,
              profiles (
                full_name,
                email
              )
            )
          )
        `)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }

      const conversationsData = participantData?.map(p => {
        const conv = p.conversations;
        const participants = conv.conversation_participants || [];
        
        // For 1-on-1 chats, use the other person's name
        let displayName = conv.name;
        if (!conv.is_group && participants.length === 2) {
          const otherParticipant = participants.find(part => part.user_id !== user?.id);
          displayName = otherParticipant?.profiles?.full_name || otherParticipant?.profiles?.email || 'Unknown User';
        }

        return {
          id: conv.id,
          name: displayName,
          is_group: conv.is_group,
          lastMessage: "No messages yet",
          time: new Date(conv.created_at).toLocaleDateString(),
          unread: 0,
          participants
        };
      }) || [];

      setConversations(conversationsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id (
            full_name,
            email
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        messagesData?.map(async (msg) => {
          try {
            const response = await supabase.functions.invoke('encryption', {
              body: {
                action: 'decrypt',
                conversationId,
                encryptedMessage: msg.content_encrypted,
                iv: msg.iv
              }
            });

            if (response.error) {
              console.error('Decryption error:', response.error);
              return {
                id: msg.id,
                content: '[Decryption failed]',
                sender: msg.sender_id === user?.id ? 'user' as const : 'contact' as const,
                timestamp: new Date(msg.created_at),
                delivered: true,
                read: true,
                senderId: msg.sender_id
              };
            }

            return {
              id: msg.id,
              content: response.data.message,
              sender: msg.sender_id === user?.id ? 'user' as const : 'contact' as const,
              timestamp: new Date(msg.created_at),
              delivered: true,
              read: true,
              senderId: msg.sender_id
            };
          } catch (error) {
            console.error('Error decrypting message:', error);
            return {
              id: msg.id,
              content: '[Decryption failed]',
              sender: msg.sender_id === user?.id ? 'user' as const : 'contact' as const,
              timestamp: new Date(msg.created_at),
              delivered: true,
              read: true,
              senderId: msg.sender_id
            };
          }
        }) || []
      );

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (isMobile) {
      setShowConversations(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId || !user) return;

    try {
      // Encrypt message
      const encryptResponse = await supabase.functions.invoke('encryption', {
        body: {
          action: 'encrypt',
          conversationId: activeConversationId,
          message: content
        }
      });

      if (encryptResponse.error) {
        throw encryptResponse.error;
      }

      // Store encrypted message
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: user.id,
          content_encrypted: encryptResponse.data.encrypted,
          iv: encryptResponse.data.iv
        });

      if (insertError) {
        throw insertError;
      }

      // Reload messages
      await loadMessages(activeConversationId);

      toast({
        title: "Message sent",
        description: "Your encrypted message has been sent successfully.",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const activeContact = activeConversationId
    ? conversations.find(c => c.id === activeConversationId) || null
    : null;

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex h-full items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout>
      <div className="flex h-full">
        {(!isMobile || showConversations) && (
          <div className={`${isMobile ? "w-full" : "w-1/3"} h-full`}>
            <ConversationList
              conversations={conversations.map(c => ({
                id: c.id,
                name: c.name || 'Unnamed Chat',
                lastMessage: c.lastMessage || 'No messages yet',
                time: c.time || '',
                unread: c.unread || 0
              }))}
              activeId={activeConversationId}
              onSelectConversation={handleSelectConversation}
            />
          </div>
        )}

        {(!isMobile || !showConversations) && (
          <div className={`${isMobile ? "w-full" : "w-2/3"} h-full flex flex-col`}>
            <MessageArea
              activeContact={activeContact ? {
                id: activeContact.id,
                name: activeContact.name || 'Unknown',
                avatar: undefined,
              } : null}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}
      </div>
    </ChatLayout>
  );
};

export default Chat;
