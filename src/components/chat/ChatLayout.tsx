
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ChatLayoutProps {
  children: React.ReactNode;
}

const ChatLayout: React.FC<ChatLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = () => {
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <Shield className="h-5 w-5 text-primary mr-2" />
          <h1 className="text-lg font-bold">SecureTalk</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
};

export default ChatLayout;
