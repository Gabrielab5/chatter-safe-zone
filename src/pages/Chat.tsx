
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ChatLayout from '@/components/chat/ChatLayout';
import UserSearch from '@/components/chat/UserSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { MessageCircle, Users, Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  last_message?: string;
  last_message_time?: string;
  other_user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

const Chat: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { onlineUsers } = useUserPresence();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chats');

  const { messages, loading: messagesLoading, sendMessage } = useRealTimeMessages(selectedConversation);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            name,
            is_group,
            created_at
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Fetch conversation details with other participants
      const conversationsData = await Promise.all(
        (data || []).map(async (item) => {
          const conversation = item.conversations;
          let otherUser = null;

          if (!conversation.is_group) {
            // For direct messages, get the other participant's info
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select(`
                user_id,
                profiles (
                  id,
                  full_name,
                  display_name,
                  avatar_url
                )
              `)
              .eq('conversation_id', conversation.id)
              .neq('user_id', user?.id);

            if (participants && participants.length > 0) {
              const profile = participants[0].profiles;
              otherUser = {
                id: profile.id,
                name: profile.display_name || profile.full_name || 'Unknown User',
                avatar_url: profile.avatar_url
              };
            }
          }

          return {
            id: conversation.id,
            name: conversation.name,
            is_group: conversation.is_group,
            created_at: conversation.created_at,
            other_user: otherUser
          };
        })
      );

      setConversations(conversationsData);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (userId: string, userName: string) => {
    try {
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            is_group
          )
        `)
        .eq('user_id', user?.id);

      const directMessage = existingConversation?.find(conv => {
        return !conv.conversations.is_group;
      });

      if (directMessage) {
        // Check if the other user is in this conversation
        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', directMessage.conversation_id)
          .eq('user_id', userId)
          .single();

        if (otherParticipant) {
          setSelectedConversation(directMessage.conversation_id);
          setActiveTab('chats');
          return;
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: null,
          is_group: false,
          created_by: user?.id,
          session_key_encrypted: 'temp_key'
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          {
            conversation_id: conversation.id,
            user_id: user?.id
          },
          {
            conversation_id: conversation.id,
            user_id: userId
          }
        ]);

      if (participantError) throw participantError;

      setSelectedConversation(conversation.id);
      setActiveTab('chats');
      fetchConversations();
      
      toast({
        title: "Success",
        description: `Started chat with ${userName}`
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: "Error",
        description: "Failed to start chat",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(u => u.user_id === userId && u.is_online);
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.is_group) {
      return conversation.name || 'Group Chat';
    }
    return conversation.other_user?.name || 'Direct Message';
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
            </TabsContent>

            <TabsContent value="users" className="flex-1 overflow-y-auto m-0 p-4">
              <UserSearch onStartChat={startChat} onlineUsers={onlineUsers} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="border-b p-4">
                <h3 className="font-semibold">
                  {conversations.find(c => c.id === selectedConversation) && 
                   getConversationName(conversations.find(c => c.id === selectedConversation)!)}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
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
                        <p>{message.decrypted_content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
                <p className="text-sm mt-2">Or switch to Users tab to start a new chat</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ChatLayout>
  );
};

export default Chat;
