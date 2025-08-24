import { describe, it, expect } from 'vitest';
import { isLikelySpam, calculateSpamScore } from './utils';
import type { EphemeralEventMessage } from '@/hooks/useChatSession';

// Helper function to create a test message
function createTestMessage(content: string): EphemeralEventMessage {
  return {
    event: {
      id: 'test',
      pubkey: 'test',
      created_at: Date.now() / 1000,
      kind: 20000,
      tags: [],
      content,
      sig: 'test'
    },
    message: content
  } as EphemeralEventMessage;
}

describe('Spam Detection', () => {
  describe('Template-based spam patterns', () => {
    it('detects the specific SANTA CLAUS spam pattern', () => {
      const spamMessage = createTestMessage('SANTA CLAUS WAS>SANTA CLAUS 2025! 2zs5g9');
      expect(isLikelySpam(spamMessage)).toBe(true);
      expect(calculateSpamScore(spamMessage.message)).toBeGreaterThanOrEqual(3);
    });

    it('detects similar template spam with different random suffixes', () => {
      const spamMessages = [
        'SANTA CLAUS WAS>SANTA CLAUS 2025! 4bts2a',
        'SANTA CLAUS WAS>SANTA CLAUS 2025! g9dz67',
        'SANTA CLAUS WAS>SANTA CLAUS 2025! 8myjef',
        'SOME TEXT>MORE TEXT! abc123',
        'CAMPAIGN MESSAGE> VOTE NOW! xyz789'
      ];

      spamMessages.forEach(msg => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(true);
        expect(calculateSpamScore(msg)).toBeGreaterThanOrEqual(3);
      });
    });

    it('detects all-caps template spam', () => {
      const spamMessage = createTestMessage('POLITICAL MESSAGE>SUPPORT CANDIDATE! k0c9hq');
      expect(isLikelySpam(spamMessage)).toBe(true);
    });

    it('detects multi-delimiter spam patterns', () => {
      const spamMessage = createTestMessage('SPAM>MESSAGE!HERE>1234');
      expect(isLikelySpam(spamMessage)).toBe(true);
    });
  });



  describe('Structural anomaly detection', () => {
    it('detects messages with unusual character distributions', () => {
      const spamMessages = [
        '12345678901234567890', // All digits
        '!!!!!!!???????', // Excessive punctuation
        'AAAAAABBBBBBCCCCC', // Repeated characters
        'aBcDeFgHiJkLmNoPqRsT' // Alternating case
      ];

      spamMessages.forEach(msg => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(true);
      });
    });

    it('detects hex-like patterns', () => {
      const spamMessage = createTestMessage('Your code is: a1b2c3d4e5f67890');
      expect(isLikelySpam(spamMessage)).toBe(true);
    });

    it('detects base64-like patterns', () => {
      const spamMessage = createTestMessage('Data: YWJjZGVmZ2hpams= for processing');
      expect(isLikelySpam(spamMessage)).toBe(true);
    });
  });

  describe('Legitimate messages should not be flagged', () => {
    it('does not flag normal conversation', () => {
      const legitimateMessages = [
        'hello there',
        'How are you doing today?',
        'Check out this cool thing I found!',
        'Thanks for the help!',
        'Anyone want to chat?',
        'This is a longer message that should not be flagged because it looks like normal conversation',
        'Hello! How are you?',
        'Meeting at 3pm > conference room',
        'Error code: 404',
        'Hi everyone, how\'s it going?',
        'Good morning! Hope you have a great day.',
        'Can someone help me with this issue?'
      ];

      legitimateMessages.forEach((msg) => {
        const score = calculateSpamScore(msg);
        const isSpam = isLikelySpam(createTestMessage(msg));
        console.log(`Legitimate message "${msg}" score: ${score}, isSpam: ${isSpam}`);
        expect(isSpam).toBe(false);
        expect(score).toBeLessThan(3);
      });
    });

    it('does not flag legitimate reference patterns', () => {
      const legitimateMessages = [
        'My meeting ID is abc123',
        'Reference: def456',
        'Ticket number: ghi789',
        'Order ref: ABC1234',
        'Your code is: 987654'
      ];

      legitimateMessages.forEach((msg) => {
        const result = isLikelySpam(createTestMessage(msg));
        expect(result).toBe(false);
        expect(calculateSpamScore(msg)).toBeLessThan(3);
      });
    });

    it('does not flag legitimate code patterns', () => {
      const legitimateMessages = [
        'Your PIN is: 1234',
        'Code: 567890',
        'Access code: ABCDEF'
      ];

      legitimateMessages.forEach(msg => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(false);
      });
    });
  });

  describe('Edge cases and scoring', () => {
    it('correctly scores borderline cases', () => {
      const borderlineCases = [
        { msg: 'HELLO! How are you?', expected: false }, // All caps but conversational
        { msg: 'Meeting at 3pm > room A', expected: false }, // Has > but legitimate
        { msg: 'SPAM>MESSAGE! abc123', expected: true }, // Clear spam pattern
        { msg: 'Reference: abc123', expected: false }, // Legitimate reference
        { msg: 'Thanks! Your help is appreciated.', expected: false } // Conversational with punctuation
      ];

      borderlineCases.forEach(({ msg, expected }) => {
        const score = calculateSpamScore(msg);
        const isSpam = isLikelySpam(createTestMessage(msg));
        console.log(`Borderline case "${msg}" score: ${score}, isSpam: ${isSpam}, expected: ${expected}`);
        expect(isSpam).toBe(expected);
      });
    });

    it('handles short messages appropriately', () => {
      const shortMessages = [
        { msg: 'Hi!', expected: false },
        { msg: 'OK', expected: false },
        { msg: 'YES!', expected: false },
        { msg: 'FREE!', expected: false }, // No longer filtering based on words
        { msg: 'WIN!', expected: false } // No longer filtering based on words
      ];

      shortMessages.forEach(({ msg, expected }) => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(expected);
      });
    });

    it('detects spam with flexible random suffix lengths', () => {
      const spamMessages = [
        'SPAM MESSAGE! abc12', // 4 chars
        'SPAM MESSAGE! def345', // 5 chars
        'SPAM MESSAGE! ghi7890', // 6 chars
        'SPAM MESSAGE! jkl12345', // 7 chars
        'SPAM MESSAGE! mno678901' // 8 chars
      ];

      spamMessages.forEach(msg => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(true);
      });
    });

    it('does not flag legitimate messages with numbers', () => {
      const legitimateMessages = [
        'I have 2 cats and 3 dogs',
        'The meeting is at 3:30pm',
        'Please call me at extension 1234',
        'Your order number is 98765',
        'I scored 95 on the test'
      ];

      legitimateMessages.forEach(msg => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(false);
      });
    });
  });

  describe('Scoring system validation', () => {
    it('assigns appropriate scores to different spam types', () => {
      const testCases = [
        { msg: 'SANTA CLAUS WAS>SANTA CLAUS 2025! 2zs5g9', minScore: 3 }, // Template spam
        { msg: '12345678901234567890', minScore: 3 }, // Structural anomaly
        { msg: 'HELLO! How are you?', minScore: 0, maxScore: 2 }, // Legitimate all caps
        { msg: 'Reference: abc123', minScore: 0, maxScore: 1 } // Legitimate reference
      ];

      testCases.forEach(({ msg, minScore, maxScore }) => {
        const score = calculateSpamScore(msg);
        console.log(`Test case "${msg}" score: ${score}, min: ${minScore}, max: ${maxScore}`);
        expect(score).toBeGreaterThanOrEqual(minScore || 0);
        if (maxScore !== undefined) {
          expect(score).toBeLessThanOrEqual(maxScore);
        }
      });
    });
  });
});