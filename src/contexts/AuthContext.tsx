
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLoginAttempt, logRegistration, logGoogleAuth, logLogout } from '@/utils/auditLogger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
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

  useEffect(() => {
    console.log('AuthProvider: Setting up auth listener');
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log('Attempting to sign up user:', email);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
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
      
      // Log the Google auth attempt
      logGoogleAuth(!error, error?.message);
      
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

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
