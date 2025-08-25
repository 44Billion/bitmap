import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface SpamFilterContextType {
  spamFilterEnabled: boolean;
  setSpamFilterEnabled: (enabled: boolean) => void;
  toggleSpamFilter: () => void;
  blockedUsers: string[];
  blockUser: (pubkey: string) => void;
  unblockUser: (pubkey: string) => void;
  isUserBlocked: (pubkey: string) => boolean;
}

const SpamFilterContext = createContext<SpamFilterContextType | undefined>(undefined);

export function SpamFilterProvider({ children }: { children: ReactNode }) {
  const [spamFilterEnabled, setSpamFilterEnabled] = useState(true); // Default to enabled
  const [blockedUsers, setBlockedUsers] = useLocalStorage<string[]>('bitmap-blocked-users', []);

  const toggleSpamFilter = () => {
    setSpamFilterEnabled(prev => !prev);
  };

  const blockUser = (pubkey: string) => {
    setBlockedUsers(prev => {
      if (!prev.includes(pubkey)) {
        return [...prev, pubkey];
      }
      return prev;
    });
  };

  const unblockUser = (pubkey: string) => {
    setBlockedUsers(prev => prev.filter(p => p !== pubkey));
  };

  const isUserBlocked = (pubkey: string) => {
    return blockedUsers.includes(pubkey);
  };

  return (
    <SpamFilterContext.Provider value={{
      spamFilterEnabled,
      setSpamFilterEnabled,
      toggleSpamFilter,
      blockedUsers,
      blockUser,
      unblockUser,
      isUserBlocked
    }}>
      {children}
    </SpamFilterContext.Provider>
  );
}

export function useSpamFilter() {
  const context = useContext(SpamFilterContext);
  if (context === undefined) {
    throw new Error('useSpamFilter must be used within a SpamFilterProvider');
  }
  return context;
}