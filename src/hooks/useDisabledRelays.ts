import { useLocalStorage } from './useLocalStorage';

interface UseDisabledRelaysReturn {
  disabledRelays: Set<string>;
  toggleRelay: (relayUrl: string) => void;
  isRelayDisabled: (relayUrl: string) => boolean;
  enableRelay: (relayUrl: string) => void;
  disableRelay: (relayUrl: string) => void;
  getEnabledRelays: (relays: string[]) => string[];
  toggleRegionRelays: (relayUrls: string[]) => void;
  enableRegionRelays: (relayUrls: string[]) => void;
  disableRegionRelays: (relayUrls: string[]) => void;
  isRegionFullyEnabled: (relayUrls: string[]) => boolean;
  isRegionFullyDisabled: (relayUrls: string[]) => boolean;
}

const STORAGE_KEY = 'bitmap:disabled-relays';

export function useDisabledRelays(): UseDisabledRelaysReturn {
  const [disabledRelaysList, setDisabledRelaysList] = useLocalStorage<string[]>(
    STORAGE_KEY,
    []
  );

  const disabledRelays = new Set(disabledRelaysList);

  const toggleRelay = (relayUrl: string) => {
    if (disabledRelays.has(relayUrl)) {
      enableRelay(relayUrl);
    } else {
      disableRelay(relayUrl);
    }
  };

  const isRelayDisabled = (relayUrl: string) => {
    return disabledRelays.has(relayUrl);
  };

  const enableRelay = (relayUrl: string) => {
    const newList = disabledRelaysList.filter(url => url !== relayUrl);
    setDisabledRelaysList(newList);
  };

  const disableRelay = (relayUrl: string) => {
    if (!disabledRelays.has(relayUrl)) {
      setDisabledRelaysList([...disabledRelaysList, relayUrl]);
    }
  };

  const getEnabledRelays = (relays: string[]) => {
    return relays.filter(relay => !disabledRelays.has(relay));
  };

  // Region relay management functions
  const toggleRegionRelays = (relayUrls: string[]) => {
    const enabledCount = relayUrls.filter(url => !disabledRelays.has(url)).length;

    if (enabledCount === relayUrls.length) {
      // All are enabled, disable all
      disableRegionRelays(relayUrls);
    } else {
      // Some or none are enabled, enable all
      enableRegionRelays(relayUrls);
    }
  };

  const enableRegionRelays = (relayUrls: string[]) => {
    const newList = disabledRelaysList.filter(url => !relayUrls.includes(url));
    setDisabledRelaysList(newList);
  };

  const disableRegionRelays = (relayUrls: string[]) => {
    const urlsToDisable = relayUrls.filter(url => !disabledRelays.has(url));
    if (urlsToDisable.length > 0) {
      setDisabledRelaysList([...disabledRelaysList, ...urlsToDisable]);
    }
  };

  const isRegionFullyEnabled = (relayUrls: string[]) => {
    return relayUrls.every(url => !disabledRelays.has(url));
  };

  const isRegionFullyDisabled = (relayUrls: string[]) => {
    return relayUrls.every(url => disabledRelays.has(url));
  };

  return {
    disabledRelays,
    toggleRelay,
    isRelayDisabled,
    enableRelay,
    disableRelay,
    getEnabledRelays,
    toggleRegionRelays,
    enableRegionRelays,
    disableRegionRelays,
    isRegionFullyEnabled,
    isRegionFullyDisabled,
  };
}