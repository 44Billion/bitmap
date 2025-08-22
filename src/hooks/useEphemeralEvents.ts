import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface EphemeralEventData {
  event: NostrEvent;
  geohash?: string;
  nickname?: string;
  message: string;
}

function validateEphemeralEvent(event: NostrEvent): boolean {
  // Check if it's an ephemeral event
  if (event.kind !== 20000) return false;

  // Must have a geohash tag to be useful for the heat map
  const geohash = event.tags.find(([name]) => name === 'g')?.[1];
  if (!geohash) return false;

  return true;
}

function transformEphemeralEvent(event: NostrEvent): EphemeralEventData {
  const geohash = event.tags.find(([name]) => name === 'g')?.[1];
  const nickname = event.tags.find(([name]) => name === 'n')?.[1];

  return {
    event,
    geohash,
    nickname,
    message: event.content,
  };
}

export function useEphemeralEvents() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['ephemeral-events'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query ephemeral events (kind 20000)
      const events = await nostr.query([
        {
          kinds: [20000],
          limit: 500,
        }
      ], { signal });

      // Filter and transform events
      const validEvents = events
        .filter(validateEphemeralEvent)
        .map(transformEphemeralEvent);

      return validEvents;
    },
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}