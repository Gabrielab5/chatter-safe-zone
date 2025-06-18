
import { useState, useCallback } from 'react';
import E2EEPasswordModal from '@/components/auth/E2EEPasswordModal';

interface E2EESession {
  password: string | null;
  isUnlocked: boolean;
}

export const useE2EESessionManager = () => {
  const [session, setSession] = useState<E2EESession>({
    password: null,
    isUnlocked: false
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingResolve, setPendingResolve] = useState<((password: string | null) => void) | null>(null);

  const promptForPassword = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      setPendingResolve(() => resolve);
      setIsModalOpen(true);
    });
  }, []);

  const handlePasswordSubmit = useCallback((password: string) => {
    setSession({
      password,
      isUnlocked: true
    });
    setIsModalOpen(false);
    
    if (pendingResolve) {
      pendingResolve(password);
      setPendingResolve(null);
    }
  }, [pendingResolve]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    
    if (pendingResolve) {
      pendingResolve(null);
      setPendingResolve(null);
    }
  }, [pendingResolve]);

  const getSessionPassword = useCallback(async (): Promise<string | null> => {
    if (session.isUnlocked && session.password) {
      return session.password;
    }
    
    return await promptForPassword();
  }, [session, promptForPassword]);

  const clearSession = useCallback(() => {
    setSession({
      password: null,
      isUnlocked: false
    });
  }, []);

  const PasswordModal = useCallback(() => (
    <E2EEPasswordModal
      isOpen={isModalOpen}
      onClose={handleModalClose}
      onSubmit={handlePasswordSubmit}
    />
  ), [isModalOpen, handleModalClose, handlePasswordSubmit]);

  return {
    session,
    getSessionPassword,
    clearSession,
    isUnlocked: session.isUnlocked,
    PasswordModal
  };
};
