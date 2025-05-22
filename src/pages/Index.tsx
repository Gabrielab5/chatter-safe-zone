
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock } from "lucide-react";

const Index: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white to-blue-50 dark:from-securetalk-primary dark:to-securetalk-secondary">
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center">
          <Shield className="h-7 w-7 text-primary mr-2" />
          <h1 className="text-2xl font-bold">SecureTalk</h1>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/login")}
          >
            Login
          </Button>
          <Button 
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            onClick={() => navigate("/register")}
          >
            Sign Up
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex p-3 bg-primary/10 rounded-full mb-6">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Secure Communication for the Digital Age
          </h1>
          <p className="text-xl mb-8 text-muted-foreground">
            End-to-end encrypted messaging with state-of-the-art security.
            Your conversations stay private, just as they should.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={() => navigate("/register")}
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/login")}
            >
              Login to Your Account
            </Button>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-card p-6 rounded-xl shadow-md">
            <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">End-to-End Encryption</h3>
            <p className="text-muted-foreground">
              All messages are encrypted with AES-256, ensuring only you and your recipient can read them.
            </p>
          </div>

          <div className="bg-card p-6 rounded-xl shadow-md">
            <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Secure Key Exchange</h3>
            <p className="text-muted-foreground">
              Advanced key exchange protocols ensure your encryption keys are never compromised.
            </p>
          </div>

          <div className="bg-card p-6 rounded-xl shadow-md">
            <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Zero Knowledge</h3>
            <p className="text-muted-foreground">
              We can't read your messages, even if we wanted to. Your privacy is guaranteed by design.
            </p>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 border-t mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <Shield className="h-5 w-5 text-primary mr-2" />
            <span className="font-bold">SecureTalk</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SecureTalk. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
