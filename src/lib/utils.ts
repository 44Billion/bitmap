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
 * Filters messages by removing spam and duplicates.
 * Returns a filtered array with only legitimate, unique messages.
 * This function combines spam detection and deduplication in one pass.
 */
export function filterMessages(messages: EphemeralEventMessage[]): EphemeralEventMessage[] {
  // Create a map to track the oldest occurrence of each unique message per user
  const messageMap = new Map<string, EphemeralEventMessage>();

  for (const message of messages) {
    // Skip if it's detected as spam
    if (isLikelySpam(message)) {
      continue;
    }

    // Create a unique key combining user pubkey and message content for deduplication
    const uniqueKey = `${message.event.pubkey}:${message.message}`;

    // If we haven't seen this message from this user before, or if this version is older
    const existingMessage = messageMap.get(uniqueKey);
    if (!existingMessage || message.event.created_at < existingMessage.event.created_at) {
      messageMap.set(uniqueKey, message);
    }
  }

  // Convert the map values back to an array and sort by timestamp
  return Array.from(messageMap.values())
    .sort((a, b) => a.event.created_at - b.event.created_at);
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

  // Template-based spam detection
  const hasTemplateSpam = detectTemplateSpam(content);

  // Random suffix spam detection (catches patterns like "MESSAGE! abc123")
  const hasRandomSuffixSpam = detectRandomSuffixSpam(content);

  // Return true if any spam pattern matches
  return hasRepetitivePatterns ||
         hasBadLength ||
         hasExcessivePunctuation ||
         isAllCaps ||
         hasTemplateSpam ||
         hasRandomSuffixSpam
}

/**
 * Detects template-based spam where messages follow a rigid pattern with only random identifiers changing.
 * This focuses on structural patterns, not content words.
 */
function detectTemplateSpam(content: string): boolean {
  // Matches: "ALL_CAPS_TEXT>ALL_CAPS_TEXT! [6-char-random]"
  // This is very specific to the observed spam pattern
  const exactSpamPattern = /^[A-Z\s]+>[A-Z\s]+!\s*[a-z0-9]{6}$/i.test(content) &&
                           content.length > 20 &&
                           content.toUpperCase() === content;

  // Pattern 2: All-caps message with > and ! delimiters and random suffix
  const delimiterPattern = />.*!.*[a-z0-9]{6}$/i.test(content) &&
                           content.toUpperCase() === content &&
                           content.length > 15;

  // Pattern 3: Multiple special characters with random suffix (suggests bot generation)
  const multiSpecialPattern = /[><].*[!].*[a-z0-9]{6}$/i.test(content) &&
                              content.toUpperCase() === content &&
                              content.length > 20;

  return exactSpamPattern || delimiterPattern || multiSpecialPattern;
}

/**
 * Detects spam that uses random suffixes to appear unique while maintaining the same core message.
 * This focuses on the pattern of random identifiers, not message content.
 */
function detectRandomSuffixSpam(content: string): boolean {
  // Pattern 1: Message ends with exactly 6 random alphanumeric characters after a spam-like delimiter
  // Exclude legitimate cases like "Reference: def456" by requiring special spam delimiters
  const sixCharRandomSuffix = /[!><#:]\s*[a-z0-9]{6}$/i.test(content) &&
                             !/:\s*[a-z0-9]{6}$/i.test(content); // Exclude "Reference: abc123" patterns

  // Pattern 2: All-caps message with special characters and random suffix
  const allCapsWithRandomSuffix = content.length > 20 &&
                                  content.toUpperCase() === content &&
                                  /[!><#:]/.test(content) &&
                                  /[a-z0-9]{6}$/i.test(content);

  // Pattern 3: Multiple delimiters suggesting automated generation (but not legitimate use cases)
  const multiDelimiterPattern = (content.match(/[!><#:]/g) || []).length >= 2 &&
                                 /[a-z0-9]{6}$/i.test(content) &&
                                 content.toUpperCase() === content &&
                                 content.length > 15 &&
                                 !/:\s*[a-z0-9]{6}$/i.test(content); // Exclude legitimate patterns

  return (sixCharRandomSuffix && content.length > 15) ||
         allCapsWithRandomSuffix ||
         multiDelimiterPattern;
}
