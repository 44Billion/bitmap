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
 * Uses a sophisticated scoring system with multiple detection strategies.
 */
export function isLikelySpam(message: EphemeralEventMessage): boolean {
  const { message: content } = message;

  // Calculate spam score based on multiple factors
  const spamScore = calculateSpamScore(content);

  // Messages with score >= 3 are considered spam
  return spamScore >= 3;
}

/**
 * Calculates a spam score for a message based on multiple detection strategies.
 * Higher scores indicate higher likelihood of spam.
 */
export function calculateSpamScore(content: string): number {
  let score = 0;

  const lowerContent = content.toLowerCase();

  // Basic validation - only penalize very short or extremely long messages
  if (content.length < 2) {
    score += 2; // Strong penalty for very short messages
  }
  if (content.length > 1000) {
    score += 1; // Minor penalty for extremely long messages
  }

  // 1. Repetitive patterns
  const repetitivePattern = /(.{3,})\1{2,}/.test(lowerContent);
  if (repetitivePattern) {
    score += 3; // Strong indicator of spam
  }

  const longWordPattern = /\b\w{20,}\b/.test(lowerContent);
  if (longWordPattern) {
    score += 2; // Long random words are suspicious
  }

  // 2. Excessive punctuation and formatting
  if (/[!?.]{4,}/.test(lowerContent)) {
    score += 1;
  }

  if (/[!?.]{6,}/.test(lowerContent)) {
    score += 2; // Very excessive punctuation
  }

  // 3. Capitalization patterns
  if (content.length > 10 && content === content.toUpperCase()) {
    score += 2;
  }

  if (content.length > 20 && isMostlyCaps(content)) {
    score += 1; // Less strict than all caps
  }

  // 4. Template and bot patterns (integrated)
  // Pattern 1: Rigid templates with delimiters (e.g., "TEXT>TEXT! suffix")
  const templatePattern1 = />.*!.*[a-z0-9]{4,9}$/i.test(content) &&
                           content.toUpperCase() === content &&
                           content.length > 15;
  if (templatePattern1) {
    score += 3;
  }

  // Pattern 2: Multiple special characters in structured format
  const specialCharCount = (content.match(/[><#:!]/g) || []).length;
  if (specialCharCount >= 3 && content.toUpperCase() === content) {
    score += 2;
  }

  // Pattern 3: Repeated delimiter patterns (suggests automated generation)
  const repeatedDelimiters = /(>.*>){2,}|(!.*!){2,}|(#.*#){2,}/.test(content);
  if (repeatedDelimiters) {
    score += 2;
  }

  // Pattern 4: Fixed prefix with varying suffix
  const fixedPrefixPattern = /^[A-Z\s]+[>#:][A-Z\s]+[!>#:]\s*[a-z0-9]{4,9}$/i.test(content);
  if (fixedPrefixPattern && content.length > 20) {
    score += 3;
  }

  // 5. Random identifier patterns (integrated)
  // Pattern 1: Random suffixes - flexible patterns for spam
  // Look for spam template patterns: either TEXT>TEXT! random_suffix or TEXT! random_suffix
  const spamTemplatePattern1 = />.*!\s*[a-z0-9]{4,9}$/i.test(content);
  const spamTemplatePattern2 = /[A-Z\s]+!\s*[a-z0-9]{4,9}$/i.test(content);

  if (spamTemplatePattern1 || spamTemplatePattern2) {
    score += 3;

    // Additional penalty if the message is also all caps
    if (content.toUpperCase() === content) {
      score += 1;
    }
  }

  // Pattern 2: Multiple random-looking segments
  // Look for segments that are mostly alphanumeric with few vowels (more likely to be random IDs)
  const randomSegments = (content.match(/\b[a-z0-9]{4,8}\b/gi) || []).filter(segment => {
    const vowelCount = (segment.match(/[aeiou]/gi) || []).length;
    const vowelRatio = vowelCount / segment.length;
    // Consider it random if it has fewer than 30% vowels
    return vowelRatio < 0.3;
  }).length;

  if (randomSegments >= 2) {
    score += 1;

    // Stronger penalty if combined with special characters
    if (/[><#:!]/.test(content)) {
      score += 1;
    }
  }

  // Pattern 3: Hex-like patterns (common in bot-generated spam)
  // Flag hex patterns that are likely random IDs
  const hexPattern = /\b[0-9a-f]{8,}\b/i.test(content);
  if (hexPattern) {
    score += 2;
  }

  // Pattern 4: Base64-like patterns - flag patterns that look like base64 encoded data
  // More specific: look for base64 patterns that are likely encoded data, not English words
  const base64Matches = content.match(/\b[a-zA-Z0-9+/]{12,}={0,2}\b/g) || [];
  const base64Pattern = base64Matches.some(match => {
    // Check if it looks like actual base64 data rather than English words
    // Base64 data typically has high character diversity and doesn't form common English words
    const uniqueChars = new Set(match).size;
    const charDiversity = uniqueChars / match.length;

    // Also check if it contains padding (common in base64)
    const hasPadding = match.includes('=');

    // Check if it contains digits or +/ characters (more likely to be base64)
    const hasBase64Chars = /[0-9+/]/.test(match);

    // Common English words that might accidentally match base64 pattern
    const commonEnglishWords = [
      'conversation', 'information', 'technology', 'communication',
      'understanding', 'development', 'management', 'government',
      'environment', 'international', 'university', 'opportunity',
      'experience', 'individual', 'relationship', 'responsibility'
    ];

    const isCommonEnglishWord = commonEnglishWords.includes(match.toLowerCase());

    // Consider it base64-like if it has high character diversity AND has base64 characters or padding
    // But NOT if it's a common English word
    return (charDiversity > 0.6 && (hasBase64Chars || hasPadding)) && !isCommonEnglishWord;
  });

  if (base64Pattern) {
    score += 3;
  }

  // 6. Structural patterns
  const structuralScore = detectStructuralAnomalies(content);
  score += structuralScore;

  return Math.max(0, score);
}

/**
 * Checks if content is mostly capitalized (more than 70% caps)
 */
function isMostlyCaps(content: string): boolean {
  const alphaChars = content.replace(/[^a-zA-Z]/g, '');
  if (alphaChars.length < 10) return false;

  const capsCount = (alphaChars.match(/[A-Z]/g) || []).length;
  return capsCount / alphaChars.length > 0.7;
}

/**
 * Detects structural anomalies that suggest automated generation
 */
function detectStructuralAnomalies(content: string): number {
  let score = 0;

  // Unusual character distributions
  const alphaRatio = (content.match(/[a-zA-Z]/g) || []).length / content.length;
  const digitRatio = (content.match(/\d/g) || []).length / content.length;
  const specialRatio = (content.match(/[^a-zA-Z0-9\s]/g) || []).length / content.length;

  // Very high digit ratio suggests random IDs - increase threshold
  if (digitRatio > 0.5 && content.length > 15) {
    score += 2;
  }

  // Very high special character ratio
  if (specialRatio > 0.2) {
    score += 1;
  }

  // Very low alpha ratio (not much actual text)
  if (alphaRatio < 0.3 && content.length > 15) {
    score += 1;
  }

  // Repeated character patterns
  const repeatedChars = /(.)\1{3,}/g;
  const matches = content.match(repeatedChars);
  if (matches && matches.length > 1) {
    score += 1;
  }

  // Alternating case patterns (common in spam)
  const alternatingCase = /[a-z][A-Z][a-z][A-Z]|[A-Z][a-z][A-Z][a-z]/;
  if (alternatingCase.test(content)) {
    score += 1;
  }

  return score;
}


