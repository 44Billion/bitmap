import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { EphemeralEventMessage } from "@/hooks/useChatSession";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Determines if a Nostr relay error represents a complete failure (all relays failed)
 * vs a partial failure (some relays succeeded).
 */
export function isCompleteRelayFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message.includes('All relays failed') ||
    error.message.includes('No relays available') ||
    error.message.includes('Connection failed') ||
    (error.message.includes('timeout') && error.message.includes('all relays'))
  );
}

/**
 * Determines if a chat message is likely spam based on various patterns.
 * This is a simple heuristic and can be improved over time.
 */
export function isLikelySpam(message: EphemeralEventMessage): boolean {
  const { message: content, nickname } = message;

  // Convert to lowercase for case-insensitive matching
  const lowerContent = content.toLowerCase();
  const lowerNickname = (nickname || '').toLowerCase();

  // Check each spam pattern individually
  const hasRepetitivePatterns = /(.{3,})\1{2,}/.test(lowerContent) ||
                                 /\b\w{20,}\b/.test(lowerContent);

  const hasBadLength = content.length < 2 || content.length > 500;

  const hasExcessivePunctuation = /[!?.]{4,}/.test(lowerContent);

  const isAllCaps = content.length > 10 && content === content.toUpperCase();

  // Return true if any spam pattern matches
  return hasRepetitivePatterns ||
         hasBadLength ||
         hasExcessivePunctuation ||
         isAllCaps
}
