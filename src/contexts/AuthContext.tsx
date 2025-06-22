
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLoginAttempt, logRegistration, logGoogleAuth, logLogout } from '@/utils/auditLogger';
import { useE2ECrypto } from '@/hooks/useE2ECrypto';
import { useToast } from '@/hooks/use-toast';
import { generateKeyPair } from '@/utils/cryptoUtils';
import { uploadPublicKey } from '@/utils/publicKeyManager';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  initializeE2EE: (password: string) => Promise<{ error: any }>;
  hasE2EEKeys: boolean;
  sessionPrivateKey: CryptoKey | null;
  isUnlockModalOpen: boolean;
  unlockKeys: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasE2EEKeys, setHasE2EEKeys] = useState(false);
  const [sessionPrivateKey, setSessionPrivateKey] = useState<CryptoKey | null>(null);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  
  const { generateAndStoreKeys, hasExistingKeys, retrieveStoredKeys, decryptPrivateKey } = useE2ECrypto();
  const { toast } = useToast();

  // Function to ensure user has public key in profile
  const ensurePublicKey = async (userId: string) => {
    try {
      console.log('Checking if user has public key:', userId);
      
      // Check if user already has a public key
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('public_key')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching user profile:', fetchError);
        return;
      }

      // If user already has a public key, no need to generate
      if (profile?.public_key) {
        console.log('User already has public key');
        return;
      }

      console.log('Generating new key pair for user');
      
      // Generate new key pair
      const keyPair = await generateKeyPair();
      
      // Upload public key to Supabase
      await uploadPublicKey(userId, keyPair.publicKey);
      
      console.log('Public key successfully uploaded for user:', userId);
      
      toast({
        title: "Encryption Keys Generated",
        description: "Your account is now ready for secure messaging.",
      });
      
    } catch (error) {
      console.error('Error ensuring public key:', error);
      toast({
        title: "Key Generation Warning",
        description: "Failed to generate encryption keys. Some features may not work properly.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    console.log('AuthProvider: Setting up auth listener');
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Check for E2EE keys when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          // Ensure user has a public key
          setTimeout(() => {
            ensurePublicKey(session.user.id);
          }, 100);
          
          const hasKeys = await hasExistingKeys(session.user.id);
          setHasE2EEKeys(hasKeys);
          
          // If user has E2EE keys, trigger the unlock modal
          if (hasKeys) {
            setIsUnlockModalOpen(true);
          }
          
          const provider = session.user.app_metadata?.provider;
          if (provider === 'google') {
            console.log('Google auth successful, logging event');
            logGoogleAuth(true);
          }
        } else if (event === 'SIGNED_OUT') {
          setHasE2EEKeys(false);
          setSessionPrivateKey(null);
          setIsUnlockModalOpen(false);
        }
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Check for E2EE keys on initial load
      if (session?.user) {
        // Ensure user has a public key
        setTimeout(() => {
          ensurePublicKey(session.user.id);
        }, 100);
        
        const hasKeys = await hasExistingKeys(session.user.id);
        setHasE2EEKeys(hasKeys);
        
        // If user has E2EE keys, trigger the unlock modal
        if (hasKeys) {
          setIsUnlockModalOpen(true);
        }
      }
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, [hasExistingKeys]);

  const unlockKeys = async (password: string): Promise<boolean> => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return false;
    }

    try {
      console.log('Attempting to unlock E2EE keys for user:', user.id);
      
      // Retrieve stored keys
      const storedKeys = await retrieveStoredKeys(user.id);
      if (!storedKeys) {
        toast({
          title: "Error", 
          description: "No encryption keys found",
          variant: "destructive"
        });
        return false;
      }

      // Decrypt the private key with the provided password
      const privateKey = await decryptPrivateKey(
        storedKeys.encryptedPrivateKey,
        storedKeys.salt,
        password
      );

      // Store the decrypted key in session state
      setSessionPrivateKey(privateKey);
      setIsUnlockModalOpen(false);
      
      console.log('E2EE keys successfully unlocked');
      
      toast({
        title: "Success",
        description: "Your messages are now unlocked",
        variant: "default"
      });

      return true;
    } catch (error) {
      console.error('Failed to unlock keys:', error);
      
      toast({
        title: "Invalid Password",
        description: "The password you entered is incorrect",
        variant: "destructive"
      });
      
      return false;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log('Attempting to sign up user:', email);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/chat`
        }
      });
      
      console.log('Sign up result:', { data, error });
      
      // Log the registration attempt
      logRegistration(email, !error, error?.message);
      
      return { error };
    } catch (error: any) {
      console.error('Sign up error:', error);
      logRegistration(email, false, error.message);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting to sign in user:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('Sign in result:', { data, error });
      
      // Log the login attempt
      logLoginAttempt(email, !error, error?.message);
      
      return { error };
    } catch (error: any) {
      console.error('Sign in error:', error);
      logLoginAttempt(email, false, error.message);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    console.log('Attempting Google sign in');
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/chat`,
        }
      });
      
      console.log('Google sign in result:', { data, error });
      
      // Note: We'll log the success in the auth state change handler
      if (error) {
        logGoogleAuth(false, error.message);
      }
      
      return { error };
    } catch (error: any) {
      console.error('Google sign in error:', error);
      logGoogleAuth(false, error.message);
      return { error };
    }
  };

  const signOut = async () => {
    console.log('Attempting to sign out');
    
    try {
      logLogout();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      } else {
        console.log('Sign out successful');
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const resetPassword = async (email: string) => {
    console.log('Attempting password reset for:', email);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    console.log('Password reset result:', { error });
    return { error };
  };

  const initializeE2EE = async (password: string) => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      await generateAndStoreKeys(user.id, password);
      setHasE2EEKeys(true);
      return { error: null };
    } catch (error: any) {
      console.error('E2EE initialization failed:', error);
      return { error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    initializeE2EE,
    hasE2EEKeys,
    sessionPrivateKey,
    isUnlockModalOpen,
    unlockKeys,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
