import React, { useEffect } from 'react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';

/**
 * Component that automatically logs in the user if a NIP-07 extension
 * provides a public key via the (non-standard) peekPublicKey() method.
 */
export const AutoLogin: React.FC = () => {
  const { logins, addLogin, setLogin } = useNostrLogin();

  useEffect(() => {
    const tryAutoLogin = async () => {
      // If already logged in, don't auto-login
      if (logins.length > 0) return;

      // Check for window.nostr and peekPublicKey
      const nostr = (window as Window & { nostr?: { peekPublicKey?: () => Promise<string | undefined> } }).nostr;

      if (nostr?.peekPublicKey) {
        try {
          console.log('[AutoLogin] Checking for auto-login via peekPublicKey...');
          const pubkey = await nostr.peekPublicKey();

          if (pubkey) {
            console.log('[AutoLogin] Found pubkey via peekPublicKey, auto-logging in:', pubkey);

            const nostrLoginCredentials = new NLogin('extension', pubkey, null).toJSON();
            addLogin(nostrLoginCredentials);
            setLogin(nostrLoginCredentials.id);
          }
        } catch (error) {
          console.log('[AutoLogin] Error calling peekPublicKey:', error);
        }
      }
    };

    // Try immediately if already available
    tryAutoLogin();

    // Also wait a brief moment to ensure the extension has had time to inject window.nostr
    // Some extensions are slower than others.
    const timer = setTimeout(tryAutoLogin, 1000);
    return () => clearTimeout(timer);
  }, [logins.length, addLogin, setLogin]);

  return null;
};
