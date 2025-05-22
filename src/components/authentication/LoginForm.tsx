
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      // For demo purposes, any login works
      toast({
        title: "Login successful!",
        description: "Welcome back to SecureTalk.",
      });
      navigate("/chat");
    }, 1500);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="password">Password</Label>
          <Link 
            to="/forgot-password" 
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full"
        />
      </div>

      <Button 
        type="submit" 
        className="w-full bg-gradient-to-r from-primary to-accent"
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center">
            <span className="animate-pulse-slow mr-2">Loading...</span>
          </span>
        ) : (
          <span className="flex items-center">
            <LogIn className="mr-2 h-4 w-4" /> Sign In
          </span>
        )}
      </Button>

      <div className="text-center mt-4">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link 
            to="/register" 
            className="text-primary font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </form>
  );
};

export default LoginForm;
