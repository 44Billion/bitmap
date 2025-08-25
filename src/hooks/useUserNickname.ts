import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { genUserName } from '@/lib/genUserName';

interface UseUserNicknameReturn {
  nickname: string;
  setNickname: (nickname: string) => void;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  resetToDefault: () => void;
}

const STORAGE_KEY = 'user-nickname';

export function useUserNickname(): UseUserNicknameReturn {
  const { user, metadata } = useCurrentUser();
  const [storedNickname, setStoredNickname] = useLocalStorage<string>(STORAGE_KEY, '');
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNicknameState] = useState('');

  // Generate default nickname based on user metadata or pubkey
  const getDefaultNickname = useCallback(() => {
    if (!user) return '';
    
    // Use metadata name if available
    if (metadata?.name) {
      return metadata.name;
    }
    
    // Otherwise generate a username from pubkey
    return genUserName(user.pubkey);
  }, [user, metadata]);

  // Update nickname when user data or stored nickname changes
  useEffect(() => {
    if (user) {
      const defaultNick = getDefaultNickname();
      const finalNickname = storedNickname || defaultNick;
      setNicknameState(finalNickname);
    } else {
      setNicknameState('');
    }
  }, [user, storedNickname, getDefaultNickname]);

  // Set nickname and persist to localStorage
  const setNickname = useCallback((newNickname: string) => {
    if (user) {
      const trimmedNickname = newNickname.trim();
      setStoredNickname(trimmedNickname);
      setNicknameState(trimmedNickname);
    }
  }, [user, setStoredNickname]);

  // Reset to default nickname
  const resetToDefault = useCallback(() => {
    if (user) {
      const defaultNick = getDefaultNickname();
      setStoredNickname(''); // Clear stored nickname to use default
      setNicknameState(defaultNick);
    }
  }, [user, getDefaultNickname, setStoredNickname]);

  return {
    nickname,
    setNickname,
    isEditing,
    setIsEditing,
    resetToDefault,
  };
}