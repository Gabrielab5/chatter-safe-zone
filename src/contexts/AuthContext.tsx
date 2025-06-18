
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLoginAttempt, logRegistration, logGoogleAuth, logLogout } from '@/utils/auditLogger';
import { useE2ECrypto } from '@/hooks/useE2ECrypto';

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
  
  const { generateAndStoreKeys, hasExistingKeys } = useE2ECrypto();

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
          const hasKeys = await hasExistingKeys(session.user.id);
          setHasE2EEKeys(hasKeys);
          
          const provider = session.user.app_metadata?.provider;
          if (provider === 'google') {
            console.log('Google auth successful, logging event');
            logGoogleAuth(true);
          }
        } else if (event === 'SIGNED_OUT') {
          setHasE2EEKeys(false);
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
        const hasKeys = await hasExistingKeys(session.user.id);
        setHasE2EEKeys(hasKeys);
      }
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, [hasExistingKeys]);

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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
