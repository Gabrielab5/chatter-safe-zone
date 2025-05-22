
import React, { useState, useEffect } from "react";
import ChatLayout from "@/components/chat/ChatLayout";
import ConversationList, { Conversation } from "@/components/chat/ConversationList";
import MessageArea, { Message } from "@/components/chat/MessageArea";
import { useIsMobile } from "@/hooks/use-mobile";

const sampleConversations: Conversation[] = [
  {
    id: "1",
    name: "Alice Johnson",
    lastMessage: "The encryption keys have been updated.",
    time: "10:42 AM",
    unread: 2,
  },
  {
    id: "2",
    name: "Bob Smith",
    lastMessage: "Did you receive the secure file?",
    time: "Yesterday",
    unread: 0,
  },
  {
    id: "3",
    name: "Carol Taylor",
    lastMessage: "Let's use the new encryption protocol.",
    time: "Yesterday",
    unread: 0,
  },
  {
    id: "4",
    name: "Dave Wilson",
    lastMessage: "I've sent you the private key.",
    time: "Monday",
    unread: 0,
  },
  {
    id: "5",
    name: "Eve Martin",
    lastMessage: "I need access to the secure server.",
    time: "Monday",
    unread: 0,
  }
];

const initialMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "1-1",
      content: "Hi there! Have you implemented the new encryption standards?",
      sender: "contact",
      timestamp: new Date(Date.now() - 3600000),
      delivered: true,
      read: true,
    },
    {
      id: "1-2",
      content: "Yes, we're using AES-256 for all communications now.",
      sender: "user",
      timestamp: new Date(Date.now() - 3000000),
      delivered: true,
      read: true,
    },
    {
      id: "1-3",
      content: "Great! The encryption keys have been updated as well.",
      sender: "contact",
      timestamp: new Date(Date.now() - 600000),
      delivered: true,
      read: false,
    },
  ],
  "2": [
    {
      id: "2-1",
      content: "I sent you an encrypted document. Can you check if you received it?",
      sender: "contact",
      timestamp: new Date(Date.now() - 86400000),
      delivered: true,
      read: true,
    },
    {
      id: "2-2",
      content: "Got it. I'll decrypt it with my private key and take a look.",
      sender: "user",
      timestamp: new Date(Date.now() - 80000000),
      delivered: true,
      read: true,
    },
  ],
};

const Chat: React.FC = () => {
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [showConversations, setShowConversations] = useState(true);
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) {
      setShowConversations(true);
    }
  }, [isMobile]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (isMobile) {
      setShowConversations(false);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!activeConversationId) return;

    const newMessage: Message = {
      id: `${activeConversationId}-${Date.now()}`,
      content,
      sender: "user",
      timestamp: new Date(),
      delivered: true,
      read: false,
    };

    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: [
        ...(prev[activeConversationId] || []),
        newMessage,
      ],
    }));

    // Simulate response
    setTimeout(() => {
      const responseMessages = [
        "I'll check the encryption keys.",
        "Let me verify the security protocol.",
        "The message was received securely.",
        "Your encryption is working perfectly!",
        "I'll send you the decryption key soon.",
      ];
      
      const responseMessage: Message = {
        id: `${activeConversationId}-${Date.now() + 1}`,
        content: responseMessages[Math.floor(Math.random() * responseMessages.length)],
        sender: "contact",
        timestamp: new Date(),
        delivered: true,
        read: false,
      };

      setMessages((prev) => ({
        ...prev,
        [activeConversationId]: [
          ...(prev[activeConversationId] || []),
          responseMessage,
        ],
      }));
    }, 2000);
  };

  const activeContact = activeConversationId
    ? sampleConversations.find(c => c.id === activeConversationId) || null
    : null;

  return (
    <ChatLayout>
      <div className="flex h-full">
        {(!isMobile || showConversations) && (
          <div className={`${isMobile ? "w-full" : "w-1/3"} h-full`}>
            <ConversationList
              conversations={sampleConversations}
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
                name: activeContact.name,
                avatar: activeContact.avatar,
              } : null}
              messages={activeConversationId ? messages[activeConversationId] || [] : []}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}
      </div>
    </ChatLayout>
  );
};

export default Chat;
