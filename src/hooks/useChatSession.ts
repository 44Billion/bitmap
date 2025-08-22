import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useEphemeralIdentity } from './useEphemeralIdentity';
import { finalizeEvent } from 'nostr-tools';
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

interface _UseChatSessionReturn {
  session: ChatSession | null;
  isLoading: boolean;
  sendMessage: (content: string) => Promise<boolean>;
  updateNickname: (nickname: string) => void;
}

export function useChatSession(geohash: string): _UseChatSessionReturn {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const ephemeralIdentity = useEphemeralIdentity();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session - use logged-in user if available, otherwise use ephemeral identity
  useEffect(() => {
    if (geohash) {
      if (user && user.pubkey) {
        // Use logged-in user's identity
        const { metadata: userMetadata } = user as { metadata?: { name?: string } }; // Type assertion
        setSession({
          privateKey: new Uint8Array(), // Empty array for logged-in users
          pubkey: user.pubkey,
          npub: '', // We don't need npub for logged-in users
          nickname: userMetadata?.name || 'user',
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
  }, [geohash, user, ephemeralIdentity]);

  // Subscribe to new messages in the geohash
  useEffect(() => {
    if (!geohash || !nostr) return;

    const fetchLatestMessages = async () => {
      try {
        const signal = AbortSignal.timeout(15000); // 15 second timeout

        // Fetch the latest 50 messages for this geohash
        const events = await nostr.query([
          {
            kinds: [20000],
            '#g': [geohash],
            limit: 50,
          }
        ], { signal });

        // Transform events and sort by timestamp (newest last for chat display)
        const transformedMessages = events
          .map(event => ({
            event,
            geohash: event.tags.find(([name]) => name === 'g')?.[1],
            nickname: event.tags.find(([name]) => name === 'n')?.[1],
            message: event.content,
          }))
          .sort((a, b) => a.event.created_at - b.event.created_at);

        // Update the chat messages cache
        const chatKey = ['chat-messages', geohash];
        queryClient.setQueryData(chatKey, transformedMessages);
      } catch (error) {
        console.warn('Failed to fetch latest chat messages:', error);
      }
    };

    // Fetch initial messages
    fetchLatestMessages();

    // Set up periodic polling for new messages (check for new messages every 3 seconds)
    const interval = setInterval(async () => {
      try {
        const signal = AbortSignal.timeout(10000); // 10 second timeout

        // Get the current latest message timestamp to avoid duplicates
        const chatKey = ['chat-messages', geohash];
        const currentMessages = queryClient.getQueryData<EphemeralEventMessage[]>(chatKey) || [];
        const latestTimestamp = currentMessages.length > 0
          ? Math.max(...currentMessages.map(msg => msg.event.created_at))
          : 0;

        // Fetch messages newer than the latest one we have
        const newEvents = await nostr.query([
          {
            kinds: [20000],
            '#g': [geohash],
            since: latestTimestamp > 0 ? latestTimestamp + 1 : undefined,
            limit: 100,
          }
        ], { signal });

        if (newEvents.length > 0) {
          const newMessages = newEvents
            .map(event => ({
              event,
              geohash: event.tags.find(([name]) => name === 'g')?.[1],
              nickname: event.tags.find(([name]) => name === 'n')?.[1],
              message: event.content,
            }))
            .sort((a, b) => a.event.created_at - b.event.created_at);

          // Append new messages to existing ones
          queryClient.setQueryData(chatKey, [...currentMessages, ...newMessages]);
        }
      } catch (error) {
        console.warn('Failed to poll for new chat messages:', error);
      }
    }, 3000); // Poll every 3 seconds for more real-time updates

    return () => {
      clearInterval(interval);
    };
  }, [geohash, nostr, queryClient]);

  // Update nickname function
  const updateNickname = useCallback((newNickname: string) => {
    if (session && !user) {
      setSession(prev => prev ? { ...prev, nickname: newNickname } : null);
      // Also update ephemeral identity state
      ephemeralIdentity.updateNickname(newNickname);
    }
  }, [session, user, ephemeralIdentity]);

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
        // Attempt to publish the event
        await nostr.event(eventToPublish, { signal: AbortSignal.timeout(5000) });

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
        // Check if this is a complete failure (all relays failed) vs partial failure
        const isCompleteFailure = publishError instanceof Error && (
          publishError.message.includes('All relays failed') ||
          publishError.message.includes('No relays available') ||
          publishError.message.includes('Connection failed') ||
          publishError.message.includes('timeout') && publishError.message.includes('all relays')
        );

        if (isCompleteFailure) {
          console.error('All relays failed to receive the message:', publishError);
          return false; // Only return false if ALL relays failed
        }

        // For partial failures (some relays succeeded), we still consider it a success
        console.warn('Some relays failed to receive the message, but at least one relay succeeded:', publishError);

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
  }, [session, geohash, nostr, queryClient, user]);

  // Query for accessing cached chat messages (fetched by the effect above)
  const { data: _chatMessages = [] } = useQuery({
    queryKey: ['chat-messages', geohash],
    queryFn: () => {
      // Return cached data - the actual fetching is done by the effect
      return queryClient.getQueryData<EphemeralEventMessage[]>(['chat-messages', geohash]) || [];
    },
    enabled: !!geohash,
    staleTime: 1000, // Check cache frequently for new messages
  });

  return {
    session,
    isLoading,
    sendMessage,
    updateNickname,
  };
}