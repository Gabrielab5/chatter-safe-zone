
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const E2EEUnlockModal: React.FC = () => {
  const { isUnlockModalOpen, unlockKeys } = useAuth();
  const [password, setPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsUnlocking(true);
    setError('');

    try {
      const success = await unlockKeys(password);
      if (success) {
        setPassword('');
        setError('');
      } else {
        setError('Invalid password. Please try again.');
      }
    } catch (error) {
      setError('Failed to unlock keys. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <Dialog open={isUnlockModalOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Unlock Your Messages
          </DialogTitle>
          <DialogDescription className="text-left">
            Your messages are protected with end-to-end encryption. 
            Enter your encryption password to decrypt and read your messages.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="unlock-password">Encryption Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="unlock-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your encryption password"
                className="pl-10"
                autoFocus
                disabled={isUnlocking}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This is the password you set up when you first enabled E2EE.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!password.trim() || isUnlocking}
              className="w-full"
            >
              {isUnlocking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Unlocking...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Unlock Messages
                </>
              )}
            </Button>
          </div>
        </form>
        
        <div className="text-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <Lock className="h-4 w-4 mx-auto mb-1" />
          Your privacy is protected. We cannot recover your password if you forget it.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default E2EEUnlockModal;
