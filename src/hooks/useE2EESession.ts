
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

  const promptForPassword = useCallback((): string | null => {
    // Simple prompt for now - this can be enhanced with a modal later
    const password = prompt('Enter your E2EE password to decrypt messages:');
    
    if (password) {
      setSession({
        password,
        isUnlocked: true
      });
    }
    
    return password;
  }, []);

  const getSessionPassword = useCallback((): string | null => {
    if (session.isUnlocked && session.password) {
      return session.password;
    }
    
    return promptForPassword();
  }, [session, promptForPassword]);

  const clearSession = useCallback(() => {
    setSession({
      password: null,
      isUnlocked: false
    });
  }, []);

  return {
    session,
    getSessionPassword,
    clearSession,
    isUnlocked: session.isUnlocked
  };
};
