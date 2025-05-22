
import React, { useState } from "react";
import AuthLayout from "@/components/authentication/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
      toast({
        title: "Reset email sent",
        description: "Please check your email for password reset instructions.",
      });
    }, 1500);
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email to receive a password reset link"
    >
      {!isSubmitted ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-primary to-accent"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>

          <div className="text-center mt-4">
            <Link 
              to="/login" 
              className="text-primary font-medium hover:underline text-sm"
            >
              Back to Login
            </Link>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 space-y-4">
          <div className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-md">
            Reset link sent to {email}
          </div>
          <p className="text-muted-foreground text-sm">
            Please check your inbox and follow the instructions to reset your password.
          </p>
          <div className="pt-2">
            <Link 
              to="/login" 
              className="text-primary font-medium hover:underline text-sm"
            >
              Back to Login
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
