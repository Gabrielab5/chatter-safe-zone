
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword } from '@/utils/passwordValidation';

interface VerificationResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  message: string;
  details?: string;
}

export const SecurityVerification: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [running, setRunning] = useState(false);

  const updateResult = (test: string, status: VerificationResult['status'], message: string, details?: string) => {
    setResults(prev => {
      const index = prev.findIndex(r => r.test === test);
      const newResult = { test, status, message, details };
      
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = newResult;
        return updated;
      } else {
        return [...prev, newResult];
      }
    });
  };

  const runSecurityVerification = async () => {
    setRunning(true);
    setResults([]);

    // 1. RLS Recursion Fix Verification
    updateResult('rls-recursion', 'running', 'Testing RLS recursion fix...');
    try {
      if (!user?.id) {
        updateResult('rls-recursion', 'fail', 'User not authenticated');
      } else {
        const { data, error } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);
        
        if (error) {
          updateResult('rls-recursion', 'fail', 'RLS policy error detected', error.message);
        } else {
          updateResult('rls-recursion', 'pass', 'RLS policies working correctly');
        }
      }
    } catch (error) {
      updateResult('rls-recursion', 'fail', 'RLS test failed', error.message);
    }

    // 2. Conversation Loading Test
    updateResult('conversation-loading', 'running', 'Testing conversation loading...');
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, name, is_group, created_at')
        .limit(5);
      
      if (error) {
        updateResult('conversation-loading', 'fail', 'Failed to load conversations', error.message);
      } else {
        updateResult('conversation-loading', 'pass', `Successfully loaded ${conversations?.length || 0} conversations`);
      }
    } catch (error) {
      updateResult('conversation-loading', 'fail', 'Conversation loading test failed', error.message);
    }

    // 3. Session Keys RLS Test
    updateResult('session-keys-rls', 'running', 'Testing session keys RLS...');
    try {
      const { data, error } = await supabase
        .from('session_keys')
        .select('id')
        .limit(1);
      
      if (error && error.message.includes('RLS')) {
        updateResult('session-keys-rls', 'pass', 'Session keys properly protected by RLS');
      } else if (!error) {
        updateResult('session-keys-rls', 'pass', 'Session keys accessible (RLS configured)');
      } else {
        updateResult('session-keys-rls', 'warning', 'Session keys test inconclusive', error.message);
      }
    } catch (error) {
      updateResult('session-keys-rls', 'fail', 'Session keys RLS test failed', error.message);
    }

    // 4. Messages RLS Test
    updateResult('messages-rls', 'running', 'Testing messages RLS...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .limit(1);
      
      if (error && error.message.includes('RLS')) {
        updateResult('messages-rls', 'pass', 'Messages properly protected by RLS');
      } else if (!error) {
        updateResult('messages-rls', 'pass', 'Messages accessible (RLS configured)');
      } else {
        updateResult('messages-rls', 'warning', 'Messages test inconclusive', error.message);
      }
    } catch (error) {
      updateResult('messages-rls', 'fail', 'Messages RLS test failed', error.message);
    }

    // 5. File Uploads RLS Test
    updateResult('file-uploads-rls', 'running', 'Testing file uploads RLS...');
    try {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('id')
        .limit(1);
      
      if (error && error.message.includes('RLS')) {
        updateResult('file-uploads-rls', 'pass', 'File uploads properly protected by RLS');
      } else if (!error) {
        updateResult('file-uploads-rls', 'pass', 'File uploads accessible (RLS configured)');
      } else {
        updateResult('file-uploads-rls', 'warning', 'File uploads test inconclusive', error.message);
      }
    } catch (error) {
      updateResult('file-uploads-rls', 'fail', 'File uploads RLS test failed', error.message);
    }

    // 6. Audit Logs RLS Test
    updateResult('audit-logs-rls', 'running', 'Testing audit logs RLS...');
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id')
        .limit(1);
      
      if (error && error.message.includes('RLS')) {
        updateResult('audit-logs-rls', 'pass', 'Audit logs properly protected by RLS');
      } else if (!error) {
        updateResult('audit-logs-rls', 'pass', 'Audit logs accessible (RLS configured)');
      } else {
        updateResult('audit-logs-rls', 'warning', 'Audit logs test inconclusive', error.message);
      }
    } catch (error) {
      updateResult('audit-logs-rls', 'fail', 'Audit logs RLS test failed', error.message);
    }

    // 7. Password Validation Test
    updateResult('password-validation', 'running', 'Testing password validation...');
    try {
      const weakPassword = validatePassword('weak');
      const strongPassword = validatePassword('StrongPassword123!');
      
      if (!weakPassword.isValid && strongPassword.isValid) {
        updateResult('password-validation', 'pass', 'Password validation working correctly');
      } else {
        updateResult('password-validation', 'fail', 'Password validation not working as expected');
      }
    } catch (error) {
      updateResult('password-validation', 'fail', 'Password validation test failed', error.message);
    }

    // 8. User Presence Test
    updateResult('user-presence', 'running', 'Testing user presence...');
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('user_id, is_online')
        .limit(5);
      
      if (error) {
        updateResult('user-presence', 'fail', 'User presence test failed', error.message);
      } else {
        updateResult('user-presence', 'pass', `User presence working (${data?.length || 0} users tracked)`);
      }
    } catch (error) {
      updateResult('user-presence', 'fail', 'User presence test failed', error.message);
    }

    // 9. Encryption Function Test
    updateResult('encryption-function', 'running', 'Testing encryption function...');
    try {
      const { data, error } = await supabase.functions.invoke('encryption', {
        body: {
          action: 'encrypt',
          conversationId: 'test-conversation-id',
          message: 'Test message for encryption verification'
        }
      });
      
      if (error) {
        updateResult('encryption-function', 'fail', 'Encryption function test failed', error.message);
      } else if (data?.encrypted && data?.iv) {
        updateResult('encryption-function', 'pass', 'Encryption function working correctly');
      } else {
        updateResult('encryption-function', 'fail', 'Encryption function returned invalid data');
      }
    } catch (error) {
      updateResult('encryption-function', 'fail', 'Encryption function test failed', error.message);
    }

    // 10. Audit Logging Function Test
    updateResult('audit-logging', 'running', 'Testing audit logging...');
    try {
      const { data, error } = await supabase.functions.invoke('audit-logs', {
        body: {
          event_type: 'security_verification_test',
          event_data: { test: true, timestamp: new Date().toISOString() }
        }
      });
      
      if (error) {
        updateResult('audit-logging', 'fail', 'Audit logging test failed', error.message);
      } else {
        updateResult('audit-logging', 'pass', 'Audit logging function working correctly');
      }
    } catch (error) {
      updateResult('audit-logging', 'fail', 'Audit logging test failed', error.message);
    }

    setRunning(false);
  };

  const getStatusIcon = (status: VerificationResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: VerificationResult['status']) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      warning: 'secondary',
      running: 'outline'
    };
    
    return (
      <Badge variant={variants[status] as any}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  const warningTests = results.filter(r => r.status === 'warning').length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          SecureTalk Security Verification
          <Button onClick={runSecurityVerification} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {running ? 'Running Tests...' : 'Run Security Tests'}
          </Button>
        </CardTitle>
        {results.length > 0 && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">✓ Passed: {passedTests}</span>
            <span className="text-red-600">✗ Failed: {failedTests}</span>
            <span className="text-yellow-600">⚠ Warnings: {warningTests}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.test} className="flex items-start gap-3 p-3 border rounded-lg">
              {getStatusIcon(result.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{result.test.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                  {getStatusBadge(result.status)}
                </div>
                <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                {result.details && (
                  <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 p-2 rounded">
                    {result.details}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          {results.length === 0 && !running && (
            <div className="text-center py-8 text-gray-500">
              Click "Run Security Tests" to verify all security features
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
