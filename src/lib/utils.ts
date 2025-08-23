import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { EphemeralEventMessage } from "@/hooks/useChatSession";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncates a nickname to a specified maximum length with ellipsis.
 * Ensures the result is alphanumeric and properly formatted.
 */
export function truncateNickname(nickname: string | undefined, maxLength: number = 20): string {
  if (!nickname) return 'anonymous';

  // Remove any non-alphanumeric characters except spaces
  const cleaned = nickname.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  if (cleaned.length <= maxLength) {
    return cleaned || 'anonymous';
  }

  // Truncate and add ellipsis
  return cleaned.substring(0, maxLength - 3) + '...';
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
  const { message: content } = message;

  // Convert to lowercase for case-insensitive matching
  const lowerContent = content.toLowerCase();

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
