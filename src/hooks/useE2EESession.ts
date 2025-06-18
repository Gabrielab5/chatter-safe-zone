
import { useState, useCallback } from 'react';

interface E2EESession {
  password: string | null;
  isUnlocked: boolean;
}

export const useE2EESession = () => {
  const [session, setSession] = useState<E2EESession>({
    password: null,
    isUnlocked: false
  });

  const setSessionPassword = useCallback((password: string) => {
    setSession({
      password,
      isUnlocked: true
    });
  }, []);

  const getSessionPassword = useCallback((): string | null => {
    if (session.isUnlocked && session.password) {
      return session.password;
    }
    
    // Return null if no password is available - the calling component
    // should handle prompting for the password
    return null;
  }, [session]);

  const clearSession = useCallback(() => {
    setSession({
      password: null,
      isUnlocked: false
    });
  }, []);

  return {
    session,
    setSessionPassword,
    getSessionPassword,
    clearSession,
    isUnlocked: session.isUnlocked
  };
};
