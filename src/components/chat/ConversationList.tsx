
import React, { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string;
  onSelectConversation: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelectConversation,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = conversations.filter((convo) =>
    convo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 flex items-center justify-between border-b">
        <h2 className="text-lg font-semibold">Chats</h2>
        <Button size="icon" variant="ghost" className="rounded-full">
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations"
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 hover:bg-muted cursor-pointer flex items-center ${
                activeId === conversation.id
                  ? "bg-muted dark:bg-muted/20"
                  : ""
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <Avatar className="h-10 w-10 mr-3">
                {conversation.avatar ? (
                  <img src={conversation.avatar} alt={conversation.name} />
                ) : (
                  <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center font-medium">
                    {conversation.name.charAt(0)}
                  </div>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium truncate">{conversation.name}</h3>
                  <span className="text-xs text-muted-foreground ml-2">
                    {conversation.time}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.lastMessage}
                </p>
              </div>
              {conversation.unread > 0 && (
                <div className="ml-2 bg-primary text-xs rounded-full h-5 w-5 flex items-center justify-center text-primary-foreground">
                  {conversation.unread}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No conversations found
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
