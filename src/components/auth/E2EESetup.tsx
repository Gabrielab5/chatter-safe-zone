
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Key, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const E2EESetup: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { initializeE2EE, hasE2EEKeys } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { error } = await initializeE2EE(password);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "E2EE Setup Complete",
        description: "Your encryption keys have been generated and stored securely.",
      });
      
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('E2EE setup failed:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to set up end-to-end encryption.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (hasE2EEKeys) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-green-500" />
            End-to-End Encryption Active
          </CardTitle>
          <CardDescription>
            Your messages are protected with end-to-end encryption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-sm text-green-600">
            <Lock className="h-4 w-4" />
            <span>All your messages are encrypted and secure</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Key className="h-5 w-5 mr-2" />
          Set Up End-to-End Encryption
        </CardTitle>
        <CardDescription>
          Create a secure password to protect your encryption keys. This password will be used to encrypt your private key locally.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> This password is used to encrypt your private key on your device. 
            If you forget this password, you will lose access to your encrypted messages. 
            Choose a strong, memorable password.
          </AlertDescription>
        </Alert>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e2ee-password">Encryption Password</Label>
            <Input
              id="e2ee-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password"
              required
              disabled={isGenerating}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              disabled={isGenerating}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isGenerating || !password || !confirmPassword}
          >
            {isGenerating ? (
              <>
                <Key className="h-4 w-4 mr-2 animate-spin" />
                Generating Keys...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Set Up Encryption
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default E2EESetup;
