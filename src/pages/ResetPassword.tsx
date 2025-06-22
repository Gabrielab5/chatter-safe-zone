
import React, { useState, useEffect } from "react";
import AuthLayout from "@/components/authentication/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're in password recovery mode by looking at the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      console.log('Password recovery mode detected');
      setIsRecoveryMode(true);
      
      // Set the session with the recovery token
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      });
    }

    // Listen for auth state changes to handle the reset token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log('Password recovery event received');
        setIsRecoveryMode(true);
      }
      
      if (event === "SIGNED_IN" && session) {
        console.log('User signed in during password recovery');
        setIsRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const validatePassword = () => {
    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return false;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password updated",
          description: "Your password has been successfully updated.",
        });
        
        // Sign out and redirect to login
        await supabase.auth.signOut();
        navigate("/login");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecoveryMode) {
    return (
      <AuthLayout
        title="Invalid Reset Link"
        subtitle="This password reset link is invalid or has expired"
      >
        <div className="text-center py-4 space-y-4">
          <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-md">
            The password reset link is invalid or has expired. Please request a new one.
          </div>
          <div className="pt-2">
            <Link 
              to="/forgot-password" 
              className="text-primary font-medium hover:underline text-sm"
            >
              Request New Reset Link
            </Link>
          </div>
          <div className="pt-2">
            <Link 
              to="/login" 
              className="text-primary font-medium hover:underline text-sm"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your new password"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {passwordError && (
            <p className="text-destructive text-sm">{passwordError}</p>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-primary to-accent"
          disabled={isLoading}
        >
          {isLoading ? "Updating..." : "Update Password"}
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
    </AuthLayout>
  );
};

export default ResetPassword;
