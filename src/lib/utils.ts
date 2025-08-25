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
 * Filters messages by removing spam, duplicates, repetitive spam, and flood spam.
 * Returns a filtered array with only legitimate, unique messages.
 * This function combines multiple detection strategies in one pass.
 */
export function filterMessages(messages: EphemeralEventMessage[]): EphemeralEventMessage[] {
  // Sort messages by timestamp first to ensure proper order for all detection methods
  const sortedMessages = [...messages].sort((a, b) => a.event.created_at - b.event.created_at);

  // Create a map to track the oldest occurrence of each unique message per user
  const messageMap = new Map<string, EphemeralEventMessage>();

  for (let i = 0; i < sortedMessages.length; i++) {
    const message = sortedMessages[i];

    // Skip if it's detected as basic spam
    if (isLikelySpam(message)) {
      continue;
    }

    // Check for repetitive spam using recent messages (look at messages before current one)
    const recentMessages = sortedMessages.slice(0, i);
    if (isRepetitiveSpam(message, recentMessages)) {
      continue;
    }

    // Check for flood spam using enhanced rate limiting and similarity detection
    if (isFloodSpam(message, recentMessages)) {
      continue;
    }

    // Create a unique key combining user pubkey and message content for deduplication
    // Only apply deduplication for messages within a short time window (5 minutes)
    const currentTime = message.event.created_at;
    const uniqueKey = `${message.event.pubkey}:${message.message}`;

    // Check if we have a duplicate within the time window
    const existingMessage = messageMap.get(uniqueKey);
    if (existingMessage) {
      const timeDiff = currentTime - existingMessage.event.created_at;
      // If messages are more than 5 minutes apart, keep both
      if (timeDiff > 300) { // 5 minutes = 300 seconds
        messageMap.set(`${uniqueKey}:${currentTime}`, message);
      }
      // Otherwise, keep only the older one
      else if (currentTime < existingMessage.event.created_at) {
        messageMap.set(uniqueKey, message);
      }
    } else {
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
 * Enhanced repetition detection to handle rapid-fire repeated messages.
 * This specifically targets spam that sends identical messages in quick succession.
 */
export function isRepetitiveSpam(
  message: EphemeralEventMessage,
  recentMessages: EphemeralEventMessage[],
  timeWindow: number = 30000, // 30 seconds default
  maxRepeats: number = 3
): boolean {
  const { message: content, event } = message;
  const currentTime = event.created_at * 1000; // Convert to milliseconds

  // Find recent messages from the same user within the time window
  const recentUserMessages = recentMessages.filter(msg =>
    msg.event.pubkey === event.pubkey &&
    msg.event.id !== event.id && // Exclude the current message
    (currentTime - (msg.event.created_at * 1000)) <= timeWindow
  );

  // Count exact content matches
  const exactMatches = recentUserMessages.filter(msg =>
    msg.message === content
  );

  // If there are too many exact matches in the time window, it's spam
  if (exactMatches.length >= maxRepeats - 1) { // -1 because we're checking against previous messages
    return true;
  }

  // Count similar content matches (case-insensitive, trimmed)
  const similarMatches = recentUserMessages.filter(msg => {
    const normalizedCurrent = content.trim().toLowerCase();
    const normalizedMsg = msg.message.trim().toLowerCase();
    return normalizedCurrent === normalizedMsg;
  });

  // If there are too many similar matches in the time window, it's spam
  if (similarMatches.length >= maxRepeats - 1) {
    return true;
  }

  // Additional check: if the same user has sent many messages in short time
  if (recentUserMessages.length >= maxRepeats * 2) {
    // Check if most messages are very similar (indicating spam bot behavior)
    const messageVariations = new Set(
      recentUserMessages.map(msg => msg.message.trim().toLowerCase())
    );

    // If the user has sent many messages but with very few unique variations
    if (messageVariations.size <= 2 && recentUserMessages.length >= maxRepeats * 3) {
      return true;
    }

    // Check for slight variations of the same message (adding punctuation, etc.)
    const baseMessage = content.trim().toLowerCase();
    const normalizedBase = baseMessage.replace(/[!?.]+/g, '').trim();

    const variationMatches = recentUserMessages.filter(msg => {
      const msgContent = msg.message.trim().toLowerCase();
      const normalizedMsg = msgContent.replace(/[!?.]+/g, '').trim();

      // Check if the normalized versions are the same (ignoring extra punctuation)
      if (normalizedBase === normalizedMsg) {
        return true;
      }

      // Check if one is a substring of the other (for cases like "more than 10 bots" vs "more than 10 bots!")
      if (normalizedBase.length > 0 && normalizedMsg.length > 0) {
        return normalizedMsg.includes(normalizedBase) || normalizedBase.includes(normalizedMsg);
      }

      return false;
    });

    // For high frequency scenarios, be more aggressive
    if (recentUserMessages.length >= 3) {
      const verySimilarMatches = recentUserMessages.filter(msg => {
        const msgContent = msg.message.trim().toLowerCase();
        // Check if messages are very similar (differing only by punctuation)
        const baseWithoutPunct = baseMessage.replace(/[!?.\s]+/g, '').trim();
        const msgWithoutPunct = msgContent.replace(/[!?.\s]+/g, '').trim();
        return baseWithoutPunct === msgWithoutPunct;
      });

      if (verySimilarMatches.length >= 2) {
        return true;
      }
    }

    if (variationMatches.length >= maxRepeats - 1) {
      return true;
    }
  }

  return false;
}



/**
 * Calculates the Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 */
export function levenshteinDistance(str1: string, str2: string): number {
  if (str1.length > 1000 || str2.length > 1000) {
    return Math.abs(str1.length - str2.length); // Simple fallback
  }

  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculates the similarity ratio between two strings using Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function similarityRatio(str1: string, str2: string): number {
  if (str1.length > 1000 || str2.length > 1000) {
    return 0; // Conservative approach
  }

  const normalized1 = str1.trim().toLowerCase();
  const normalized2 = str2.trim().toLowerCase();

  if (normalized1 === normalized2) return 1;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - (distance / maxLength);
}

/**
 * Enhanced flood detection that checks for excessive message frequency from a single user.
 * This uses both rate limiting and similarity analysis to catch sophisticated spam bots.
 */
export function isFloodSpam(
  message: EphemeralEventMessage,
  recentMessages: EphemeralEventMessage[],
  timeWindow: number = 60000, // 1 minute default
  maxMessages: number = 5, // max messages per timeWindow
  similarityThreshold: number = 0.8 // 80% similarity threshold
): boolean {
  const { event, message: content } = message;
  const currentTime = event.created_at * 1000; // Convert to milliseconds

  // Find recent messages from the same user within the time window
  const recentUserMessages = recentMessages.filter(msg =>
    msg.event.pubkey === event.pubkey &&
    msg.event.id !== event.id && // Exclude the current message
    (currentTime - (msg.event.created_at * 1000)) <= timeWindow
  );

  // Basic rate limiting: too many messages in short time
  if (recentUserMessages.length >= maxMessages) {
    return true;
  }

  // Enhanced similarity-based flood detection
  if (recentUserMessages.length >= 2) {
    const normalizedContent = content.trim().toLowerCase();

    // Check for high similarity with recent messages
    const similarMessages = recentUserMessages.filter(msg => {
      const similarity = similarityRatio(msg.message, content);
      return similarity >= similarityThreshold;
    });

    // If multiple recent messages are very similar, it's likely flood spam
    if (similarMessages.length >= Math.max(2, Math.floor(maxMessages / 2))) {
      return true;
    }

    // Check for patterns that suggest automated flooding
    // Pattern 1: Messages that are slight variations of each other
    if (recentUserMessages.length >= 3) {
      const variations = recentUserMessages.map(msg => {
        const normalized = msg.message.trim().toLowerCase();
        // Remove punctuation and extra whitespace for comparison
        return normalized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      });

      const currentVariation = normalizedContent.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

      // Count how many variations are very similar to the current message
      const similarVariations = variations.filter(variation => {
        if (variation === currentVariation) return true;
        const similarity = similarityRatio(variation, currentVariation);
        return similarity >= 0.9; // Higher threshold for cleaned variations
      });

      if (similarVariations.length >= 2) {
        return true;
      }
    }

    // Pattern 2: Messages with similar length patterns (suggests template-based spam)
    if (recentUserMessages.length >= 3) {
      const lengths = recentUserMessages.map(msg => msg.message.length);
      const currentLength = content.length;

      // Check if current message length is very close to recent messages
      const similarLengths = lengths.filter(length =>
        Math.abs(length - currentLength) <= 3 // Within 3 characters
      );

      // If most messages have similar length, it's suspicious
      if (similarLengths.length >= Math.floor(recentUserMessages.length * 0.7)) {
        // Additional check: verify content similarity too
        const contentSimilarities = recentUserMessages.map(msg =>
          similarityRatio(msg.message, content)
        );
        const avgSimilarity = contentSimilarities.reduce((a, b) => a + b, 0) / contentSimilarities.length;

        if (avgSimilarity >= 0.6) { // 60% average similarity
          return true;
        }
      }
    }

    // Pattern 3: Character-level similarity patterns
    if (recentUserMessages.length >= 2) {
      const allMessages = [content, ...recentUserMessages.map(msg => msg.message)];
      const charSets = allMessages.map(msg => new Set(msg.toLowerCase().split('')));

      // Check if messages use very similar character sets
      const currentCharSet = charSets[0];
      const similarCharSets = charSets.slice(1).filter(charSet => {
        const intersection = new Set([...currentCharSet].filter(char => charSet.has(char)));
        const union = new Set([...currentCharSet, ...charSet]);
        const jaccardSimilarity = intersection.size / union.size;
        return jaccardSimilarity >= 0.8; // 80% character set similarity
      });

      if (similarCharSets.length >= Math.floor(recentUserMessages.length * 0.8)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculates a spam score for a message based on multiple detection strategies.
 * Higher scores indicate higher likelihood of spam.
 */
export function calculateSpamScore(content: string): number {
  let score = 0;

  if (content.length > 5000) {
    return 1; // Minor penalty for very long content but don't process further
  }

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
  if (content.length > 5000) {
    return false;
  }

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

  if (content.length > 5000) {
    return 0;
  }

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


