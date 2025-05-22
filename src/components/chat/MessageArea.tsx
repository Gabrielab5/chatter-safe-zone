
import React, { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface Message {
  id: string;
  content: string;
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read: boolean;
}

interface MessageAreaProps {
  activeContact: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

const MessageArea: React.FC<MessageAreaProps> = ({
  activeContact,
  messages,
  onSendMessage,
}) => {
  const [newMessage, setNewMessage] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };

  if (!activeContact) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20 dark:bg-muted/5">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <Lock className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-1">No conversation selected</h2>
          <p className="text-muted-foreground">
            Select a contact to start a secure conversation
          </p>
        </div>
      </div>
    );
  }

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b p-3">
        <Avatar className="h-10 w-10 mr-3">
          {activeContact.avatar ? (
            <img src={activeContact.avatar} alt={activeContact.name} />
          ) : (
            <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium">
              {activeContact.name.charAt(0)}
            </div>
          )}
        </Avatar>
        <div className="flex-1">
          <h2 className="font-medium">{activeContact.name}</h2>
          <div className="flex items-center text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            Online
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-3 w-3 ml-2 text-accent" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>End-to-end encrypted</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isSentByUser = message.sender === "user";
              return (
                <div
                  key={message.id}
                  className={`flex ${
                    isSentByUser ? "justify-end" : "justify-start"
                  } animate-slide-in`}
                >
                  <div className="flex flex-col max-w-[70%]">
                    <div
                      className={`message-bubble ${
                        isSentByUser
                          ? "message-bubble-sent"
                          : "message-bubble-received"
                      }`}
                    >
                      {message.content}
                    </div>
                    <div
                      className={`text-xs mt-1 text-muted-foreground flex items-center ${
                        isSentByUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {formatMessageTime(message.timestamp)}
                      {isSentByUser && message.delivered && (
                        <span className="ml-1">✓</span>
                      )}
                      {isSentByUser && message.read && (
                        <span className="ml-1">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfMessagesRef} />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="border-t p-3 flex items-center space-x-2"
      >
        <Input
          placeholder="Type a secure message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default MessageArea;
