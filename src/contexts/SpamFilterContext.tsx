import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SpamFilterContextType {
  spamFilterEnabled: boolean;
  setSpamFilterEnabled: (enabled: boolean) => void;
  toggleSpamFilter: () => void;
}

const SpamFilterContext = createContext<SpamFilterContextType | undefined>(undefined);

export function SpamFilterProvider({ children }: { children: ReactNode }) {
  const [spamFilterEnabled, setSpamFilterEnabled] = useState(true); // Default to enabled

  const toggleSpamFilter = () => {
    setSpamFilterEnabled(prev => !prev);
  };

  return (
    <SpamFilterContext.Provider value={{
      spamFilterEnabled,
      setSpamFilterEnabled,
      toggleSpamFilter
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