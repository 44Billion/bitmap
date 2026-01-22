import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useEphemeralIdentity } from './useEphemeralIdentity';
import { useUserNickname } from './useUserNickname';
import { finalizeEvent } from 'nostr-tools';
import { isCompleteRelayFailure, truncateNickname } from '@/lib/utils';
import { fetchGeoRelays } from '@/lib/georelays';
import type { NostrEvent } from '@nostrify/nostrify';

export interface EphemeralEventMessage {
  event: NostrEvent;
  geohash?: string;
  nickname?: string;
  message: string;
}

interface ChatSession {
  privateKey: Uint8Array;
  pubkey: string;
  npub: string;
  nickname: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface _UseChatSessionReturn {
  session: ChatSession | null;
  isLoading: boolean;
  messages: EphemeralEventMessage[];
  sendMessage: (content: string) => Promise<boolean>;
  updateNickname: (nickname: string) => void;
  connectionStatus: ConnectionStatus;
  onNewMessage?: (message: EphemeralEventMessage) => void;
}

// 1 hour in seconds for message time limit
const ONE_HOUR_SECONDS = 60 * 60;

// Default relays that are always available immediately
const DEFAULT_CHAT_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];

export function useChatSession(
  geohash: string,
  initialEvents: EphemeralEventMessage[] = [],
  onNewMessage?: (message: EphemeralEventMessage) => void
): _UseChatSessionReturn {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const ephemeralIdentity = useEphemeralIdentity();
  const { nickname: userNickname, setNickname: setUserNickname } = useUserNickname();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeededInitialEvents, setHasSeededInitialEvents] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  // Initialize session - use logged-in user if available, otherwise use ephemeral identity
  useEffect(() => {
    if (geohash) {
      if (user && user.pubkey) {
        // Use logged-in user's identity with custom nickname
        setSession({
          privateKey: new Uint8Array(), // Empty array for logged-in users
          pubkey: user.pubkey,
          npub: '', // We don't need npub for logged-in users
          nickname: userNickname || 'user',
        });
      } else if (ephemeralIdentity.identity) {
        // Use ephemeral identity
        setSession(ephemeralIdentity.identity);
      } else {
        // Generate new ephemeral identity
        const newIdentity = ephemeralIdentity.generateIdentity();
        setSession(newIdentity);
      }
      setIsLoading(false);
    }
  }, [geohash, user, ephemeralIdentity, userNickname]);

  // Cache for geo relays once fetched
  const [geoRelaysCache, setGeoRelaysCache] = useState<string[]>([]);

  // Fetch geo relays in background (non-blocking)
  useEffect(() => {
    let cancelled = false;
    fetchGeoRelays()
      .then((relays) => {
        if (!cancelled && relays.length > 0) {
          const rotationIndex = Math.floor(Date.now() / 300000) % Math.max(1, relays.length);
          const selectedRegionalRelays = relays.slice(rotationIndex, rotationIndex + 8);
          setGeoRelaysCache(selectedRegionalRelays.map(r => r.url));
        }
      })
      .catch((error) => {
        console.warn('Failed to fetch geo relays for chat:', error);
      });
    return () => { cancelled = true; };
  }, []);

  // Get the relays to use for chat - returns immediately with defaults, adds geo relays when available
  const getChatRelays = useCallback((): string[] => {
    const allRelays = new Set<string>(DEFAULT_CHAT_RELAYS);
    geoRelaysCache.forEach(relay => allRelays.add(relay));
    return Array.from(allRelays);
  }, [geoRelaysCache]);

  // Seed initial events from the preview (runs once when dialog opens)
  useEffect(() => {
    if (!geohash || hasSeededInitialEvents) return;

    if (initialEvents.length > 0) {
      const chatKey = ['chat-messages', geohash];
      // Sort by timestamp (oldest first for chat display)
      const sortedEvents = [...initialEvents].sort((a, b) => a.event.created_at - b.event.created_at);
      queryClient.setQueryData(chatKey, sortedEvents);
      setHasSeededInitialEvents(true);
    }
  }, [geohash, initialEvents, hasSeededInitialEvents, queryClient]);

  // Subscribe to new messages in the geohash using real-time subscriptions
  useEffect(() => {
    if (!geohash || !nostr) return;

    const chatRelays = getChatRelays();
    const chatKey = ['chat-messages', geohash];
    const abortController = new AbortController();
    let isSubscribed = true;

    const fetchLatestMessages = async () => {
      try {
        setConnectionStatus('connecting');
        const signal = AbortSignal.timeout(45000); // 45 second timeout for initial fetch

        // Get existing messages (may include seeded initial events)
        const existingMessages = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey) || [];
        const existingIds = new Set(existingMessages.map(m => m.event.id));

        // Fetch kind 20000 events from the last hour
        // Then filter locally by exact geohash match
        const oneHourAgo = Math.floor(Date.now() / 1000) - ONE_HOUR_SECONDS;
        const events = await nostr.query([
          {
            kinds: [20000],
            since: oneHourAgo,
            limit: 500,
          }
        ], { signal, relays: chatRelays });

        // Filter to only events matching our exact geohash and transform
        const fetchedMessages = events
          .filter(event => {
            const eventGeohash = event.tags.find(([name]) => name === 'g')?.[1];
            return eventGeohash === geohash;
          })
          .map(event => {
            const rawNickname = event.tags.find(([name]) => name === 'n')?.[1];
            return {
              event,
              geohash: event.tags.find(([name]) => name === 'g')?.[1],
              nickname: truncateNickname(rawNickname),
              message: event.content,
            };
          });

        // Merge with existing messages, avoiding duplicates
        const newMessages = fetchedMessages.filter(m => !existingIds.has(m.event.id));
        const allMessages = [...existingMessages, ...newMessages]
          .sort((a, b) => a.event.created_at - b.event.created_at);

        // Update the chat messages cache
        if (isSubscribed) {
          queryClient.setQueryData(chatKey, allMessages);
          setConnectionStatus('connected');
        }
      } catch (error) {
        console.warn('Failed to fetch latest chat messages:', error);
        if (isSubscribed) {
          setConnectionStatus('error');
        }
      }
    };

    // Fetch initial messages
    fetchLatestMessages();

    // Set up real-time subscription for new messages
    const subscribeToMessages = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);

        const subscription = nostr.req([
          {
            kinds: [20000],
            since: now,
            limit: 100,
          }
        ], { signal: abortController.signal, relays: chatRelays });

        // Process incoming messages in real-time using async iteration
        for await (const msg of subscription) {
          if (!isSubscribed) break;

          if (msg[0] === 'EVENT') {
            const event = msg[2];

            try {
              // Filter to exact geohash match
              const eventGeohash = event.tags.find(([name]) => name === 'g')?.[1];
              if (eventGeohash !== geohash) continue;

              const rawNickname = event.tags.find(([name]) => name === 'n')?.[1];
              const newMessage: EphemeralEventMessage = {
                event,
                geohash: eventGeohash,
                nickname: truncateNickname(rawNickname),
                message: event.content,
              };

              // Add to cache, avoiding duplicates
              const currentMessages = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey) || [];
              const existingIds = new Set(currentMessages.map(m => m.event.id));

              if (!existingIds.has(event.id) && isSubscribed) {
                queryClient.setQueryData(chatKey, [...currentMessages, newMessage]);

                // Call the callback for new messages
                if (onNewMessage) {
                  onNewMessage(newMessage);
                }
              }
            } catch (error) {
              console.warn('Failed to process real-time chat message:', error);
            }
          } else if (msg[0] === 'EOSE') {
            console.log('Chat subscription: End of stored events');
            if (isSubscribed) {
              setConnectionStatus('connected');
            }
          } else if (msg[0] === 'CLOSED') {
            console.log('Chat subscription: Connection closed');
            if (isSubscribed) {
              setConnectionStatus('disconnected');
            }
            break;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to maintain real-time chat subscription:', error);
        }
      }
    };

    // Start the subscription
    subscribeToMessages();

    return () => {
      isSubscribed = false;
      abortController.abort();
    };
  }, [geohash, nostr, queryClient, getChatRelays, onNewMessage]);

  // Update nickname function
  const updateNickname = useCallback((newNickname: string) => {
    if (session) {
      if (user) {
        // Update logged-in user's nickname
        setUserNickname(newNickname);
        setSession(prev => prev ? { ...prev, nickname: newNickname } : null);
      } else {
        // Update ephemeral user's nickname
        setSession(prev => prev ? { ...prev, nickname: newNickname } : null);
        // Also update ephemeral identity state
        ephemeralIdentity.updateNickname(newNickname);
      }
    }
  }, [session, user, ephemeralIdentity, setUserNickname]);

  // Handle initial events from map bubble
  useEffect(() => {
    if (geohash) {
      const chatKey = ['chat-messages', geohash];
      const currentMessages = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey);

      // Only set initial data if we don't have any messages yet
      if (!currentMessages || currentMessages.length === 0) {
        // This will be populated by the fetchLatestMessages effect
        queryClient.setQueryData(chatKey, []);
      }
    }
  }, [geohash, queryClient]);

  // Send message function
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!session || !geohash || !nostr) {
      return false;
    }

    try {
      const baseEvent = {
        kind: 20000,
        pubkey: session.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['g', geohash],
          ['n', session.nickname],
          ['t', 'teleport'],
          ['client', 'bitmap-chat']
        ],
        content,
      };

      // For logged-in users, the nostr client will handle signing
      // For ephemeral users, we need to sign the event properly
      let eventToPublish: NostrEvent;

      if (user && user.signer) {
        // Let the signer handle the event creation and signing
        eventToPublish = await user.signer.signEvent(baseEvent);
      } else if (session && session.privateKey.length > 0) {
        // For ephemeral users, sign the event using nostr-tools
        const signedEvent = finalizeEvent(baseEvent, session.privateKey);
        eventToPublish = signedEvent;
      } else {
        // Fallback for demo (shouldn't happen with proper ephemeral identity)
        throw new Error('No valid signing method available');
      }

      try {
        // Get optimal relays for this chat (default + geo relays)
        const chatRelays = getChatRelays();

        // Attempt to publish the event to chat-specific relays
        await nostr.event(eventToPublish, {
          signal: AbortSignal.timeout(10000), // 10 second timeout for publishing
          relays: chatRelays
        });

        // If we reach here, at least one relay succeeded (or it was a partial failure)
        // Update local cache immediately
        const chatKey = ['chat-messages', geohash];
        const existingMessages = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey) || [];
        const newMessage: EphemeralEventMessage = {
          event: eventToPublish,
          geohash,
          nickname: session.nickname,
          message: content,
        };

        queryClient.setQueryData(chatKey, [...existingMessages, newMessage]);
        return true;
      } catch (publishError) {
        if (isCompleteRelayFailure(publishError)) {
          console.error('All chat relays failed to receive the message:', publishError);
          return false; // Only return false if ALL relays failed
        }

        // For partial failures (some relays succeeded), we still consider it a success
        console.warn('Some chat relays failed to receive the message, but at least one relay succeeded:', publishError);

        // Update local cache since at least one relay succeeded
        const chatKey = ['chat-messages', geohash];
        const existingMessages = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey) || [];
        const newMessage: EphemeralEventMessage = {
          event: eventToPublish,
          geohash,
          nickname: session.nickname,
          message: content,
        };

        queryClient.setQueryData(chatKey, [...existingMessages, newMessage]);
        return true;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, [session, geohash, nostr, queryClient, user, getChatRelays]);

  // Track messages in state, synced with cache
  const [messages, setMessages] = useState<EphemeralEventMessage[]>(initialEvents);

  // Reset state when geohash changes to prevent stale messages from previous chat
  useEffect(() => {
    setHasSeededInitialEvents(false);
    setMessages(initialEvents);
  }, [geohash]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally only reset on geohash change

  // Subscribe to cache updates
  useEffect(() => {
    if (!geohash) return;

    const chatKey = ['chat-messages', geohash];

    // Get initial data from cache, or reset to empty/initial if no cached data
    const cachedData = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey);
    setMessages(cachedData ?? initialEvents);

    // Subscribe to cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === 'chat-messages' && event.query.queryKey[1] === geohash) {
        const data = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey);
        if (data) {
          setMessages(data);
        }
      }
    });

    return () => unsubscribe();
  }, [geohash, queryClient, initialEvents]);

  return {
    session,
    isLoading,
    messages,
    sendMessage,
    updateNickname,
    connectionStatus,
    onNewMessage,
  };
}