
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Key, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const MFASettings: React.FC = () => {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    checkMFAStatus();
  }, [user]);

  const checkMFAStatus = async () => {
    try {
      const response = await supabase.functions.invoke('mfa', {
        body: { action: 'status' }
      });

      if (response.error) {
        throw response.error;
      }

      setMfaEnabled(response.data.enabled);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    }
  };

  const setupMFA = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('mfa', {
        body: { action: 'setup' }
      });

      if (response.error) {
        throw response.error;
      }

      setSetupData(response.data);
      toast({
        title: "MFA Setup Initiated",
        description: "Scan the QR code with your authenticator app.",
      });
    } catch (error) {
      console.error('Error setting up MFA:', error);
      toast({
        title: "Error",
        description: "Failed to setup MFA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const enableMFA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke('mfa', {
        body: { 
          action: 'enable',
          code: verificationCode
        }
      });

      if (response.error) {
        throw response.error;
      }

      setMfaEnabled(true);
      setShowBackupCodes(true);
      setVerificationCode('');
      toast({
        title: "MFA Enabled",
        description: "Multi-factor authentication has been successfully enabled.",
      });
    } catch (error) {
      console.error('Error enabling MFA:', error);
      toast({
        title: "Error",
        description: "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('mfa', {
        body: { action: 'disable' }
      });

      if (response.error) {
        throw response.error;
      }

      setMfaEnabled(false);
      setSetupData(null);
      setShowBackupCodes(false);
      toast({
        title: "MFA Disabled",
        description: "Multi-factor authentication has been disabled.",
      });
    } catch (error) {
      console.error('Error disabling MFA:', error);
      toast({
        title: "Error",
        description: "Failed to disable MFA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          Multi-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account with two-factor authentication.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!mfaEnabled ? (
          <>
            {!setupData ? (
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  MFA is currently disabled. Enable it to secure your account.
                </p>
                <Button onClick={setupMFA} disabled={loading}>
                  <Key className="h-4 w-4 mr-2" />
                  Setup MFA
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl)}`}
                      alt="MFA QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secret">Manual Entry Key (if you can't scan QR)</Label>
                  <Input
                    id="secret"
                    value={setupData.secret}
                    readOnly
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification">Verification Code</Label>
                  <Input
                    id="verification"
                    placeholder="Enter 6-digit code from your app"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                  />
                </div>

                <Button onClick={enableMFA} disabled={loading || !verificationCode}>
                  Enable MFA
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center text-green-600">
              <Shield className="h-5 w-5 mr-2" />
              <span className="font-medium">MFA is enabled</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Your account is protected with multi-factor authentication.
            </p>

            {showBackupCodes && setupData?.backupCodes && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    Backup Codes
                  </span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                  Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-2 rounded border">
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowBackupCodes(false)}
                >
                  I've saved my backup codes
                </Button>
              </div>
            )}

            <Button variant="destructive" onClick={disableMFA} disabled={loading}>
              Disable MFA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MFASettings;
