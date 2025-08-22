import { useState, useCallback, useEffect } from 'react';
import { getPublicKey, nip19 } from 'nostr-tools';

interface EphemeralIdentity {
  privateKey: Uint8Array;
  pubkey: string;
  npub: string;
  nickname: string;
}

// Generate a random nickname for ephemeral identity
function generateRandomNickname(): string {
  const adjectives = ['stealth', 'shadow', 'ghost', 'phantom', 'wisp', 'echo', 'veil', 'mist', 'haze', 'aura'];
  const nouns = ['agent', 'runner', 'operative', 'scout', 'watcher', 'sentry', 'guardian', 'ranger', 'hunter', 'tracker'];
  const numbers = Math.floor(Math.random() * 9999) + 1;

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective}${noun}${numbers}`;
}

// Generate a proper private key as Uint8Array
function generatePrivateKey(): Uint8Array {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

export interface UseEphemeralIdentityReturn {
  identity: EphemeralIdentity | null;
  generateIdentity: () => EphemeralIdentity;
  updateNickname: (nickname: string) => void;
}

export function useEphemeralIdentity(): UseEphemeralIdentityReturn {
  const [identity, setIdentity] = useState<EphemeralIdentity | null>(null);

  // Load nickname from localStorage on mount
  useEffect(() => {
    const storedNickname = localStorage.getItem('ephemeral-nickname');
    if (storedNickname) {
      // If we have a stored nickname but no identity, generate one with stored nickname
      if (!identity) {
        const privateKey = generatePrivateKey();
        const pubkey = getPublicKey(privateKey);
        const npub = nip19.npubEncode(pubkey);

        const newIdentity: EphemeralIdentity = {
          privateKey,
          pubkey,
          npub,
          nickname: storedNickname,
        };

        setIdentity(newIdentity);
      }
    }
  }, [identity]);

  const generateIdentity = useCallback(() => {
    const privateKey = generatePrivateKey();
    const pubkey = getPublicKey(privateKey);
    const npub = nip19.npubEncode(pubkey);

    // Check if we have a stored nickname, otherwise generate random one
    const storedNickname = localStorage.getItem('ephemeral-nickname');
    const nickname = storedNickname || generateRandomNickname();

    const newIdentity: EphemeralIdentity = {
      privateKey,
      pubkey,
      npub,
      nickname,
    };

    setIdentity(newIdentity);
    return newIdentity;
  }, []);

  const updateNickname = useCallback((newNickname: string) => {
    if (identity) {
      const updatedIdentity = { ...identity, nickname: newNickname };
      setIdentity(updatedIdentity);
      // Store nickname in localStorage
      localStorage.setItem('ephemeral-nickname', newNickname);
    }
  }, [identity]);

  // Generate identity on first use
  if (!identity) {
    return {
      identity: null,
      generateIdentity,
      updateNickname,
    };
  }

  return {
    identity,
    generateIdentity,
    updateNickname,
  };
}