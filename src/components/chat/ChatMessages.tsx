
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  error?: string | null;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  selectedConversation,
  conversations,
  messages,
  messagesLoading,
  getConversationName,
  onSendMessage,
  error
}) => {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Enhanced auto-scroll with user scroll detection
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages, autoScroll]);

  // Detect if user is scrolled to bottom
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 100;
      setAutoScroll(isScrolledToBottom);
    }
  };

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      await onSendMessage(messageContent);
      // Force scroll to bottom after sending
      setAutoScroll(true);
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message content on error
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center text-muted-foreground max-w-md p-8">
          <MessageCircle className="h-20 w-20 mx-auto mb-6 opacity-50" />
          <h3 className="text-2xl font-semibold mb-4">Welcome to SecureTalk!</h3>
          <p className="mb-6 text-lg">Select a conversation to start messaging securely, or find new people to chat with.</p>
          <div className="space-y-3 text-sm bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <span className="text-green-500">🔒</span>
              <span>All messages are end-to-end encrypted</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-blue-500">👥</span>
              <span>Click "Users" tab to find people to connect with</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-purple-500">💬</span>
              <span>Your privacy and security are our top priorities</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Enhanced Header with Connection Status */}
      <div className="border-b p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              {currentConversation ? getConversationName(currentConversation) : 'Chat'}
              {connectionStatus === 'offline' && (
                <span title="Offline">
                  <WifiOff className="h-4 w-4 text-red-500" />
                </span>
              )}
              {connectionStatus === 'online' && (
                <span title="Online">
                  <Wifi className="h-4 w-4 text-green-500" />
                </span>
              )}
            </h3>
            {currentConversation && !currentConversation.is_group && currentConversation.other_user && (
              <p className="text-sm text-muted-foreground">
                Direct message with {currentConversation.other_user.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Connection Status Alert */}
      {connectionStatus === 'offline' && (
        <div className="p-2">
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You're offline. Messages will be sent when connection is restored.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation by sending a message below</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showTimestamp = index === 0 || 
                (new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime()) > 300000; // 5 minutes

              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="text-center text-xs text-muted-foreground mb-2">
                      {new Date(message.created_at).toLocaleString()}
                    </div>
                  )}
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      } shadow-sm`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.decrypted_content || (
                          <span className="italic opacity-70">
                            {message.decrypted_content === undefined ? 'Decrypting...' : 'Failed to decrypt'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && messages.length > 0 && (
        <div className="px-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAutoScroll(true);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full text-xs"
          >
            ↓ Scroll to bottom
          </Button>
        </div>
      )}

      {/* Enhanced Message Input */}
      <div className="border-t p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex space-x-2">
          <Input
            placeholder={connectionStatus === 'offline' ? 'You are offline...' : 'Type a message...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!selectedConversation || sending || connectionStatus === 'offline'}
            className="flex-1"
            maxLength={1000}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!newMessage.trim() || !selectedConversation || sending || connectionStatus === 'offline'}
            size="icon"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {newMessage.length > 800 && (
          <p className="text-xs text-muted-foreground mt-1">
            {1000 - newMessage.length} characters remaining
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatMessages;
