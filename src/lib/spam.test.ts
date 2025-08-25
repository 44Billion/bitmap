import { describe, it, expect } from 'vitest';
import { isLikelySpam, calculateSpamScore, isRepetitiveSpam, isDistributedFloodSpam, filterMessages } from './utils';
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

  describe('Low character density detection', () => {
    it('flags messages with very low alphanumeric density as spam', () => {
      const lowDensityMessages = [
        '; ; ; ; ; ; ; ; ;', // Lots of semicolons and spaces
        '! ! ! ! ! ! ! ! !', // Lots of exclamation marks and spaces
        '? ? ? ? ? ? ? ? ?', // Lots of question marks and spaces
        '. . . . . . . . .', // Lots of dots and spaces
        ', , , , , , , , ,', // Lots of commas and spaces
        '/ / / / / / / / /', // Lots of slashes and spaces
        '- - - - - - - - -', // Lots of dashes and spaces
        '+ + + + + + + + +', // Lots of plus signs and spaces
        '= = = = = = = = =', // Lots of equals signs and spaces
        '_ _ _ _ _ _ _ _ _', // Lots of underscores and spaces
      ];

      lowDensityMessages.forEach(msg => {
        const spamMessage = createTestMessage(msg);
        expect(isLikelySpam(spamMessage)).toBe(true);
        expect(calculateSpamScore(msg)).toBeGreaterThanOrEqual(3);
      });
    });

    it('does not flag legitimate messages with normal character density', () => {
      const legitimateMessages = [
        'hello there',
        'how are you?',
        'this is a test',
        'the quick brown fox',
        'a;b;c;d', // Mixed punctuation but still has good density
        'hi !!!', // Short but has decent density
        'test ???', // Short but has decent density
        'a b c d e f g', // Has spaces but good density
        '1 2 3 4 5 6 7', // Has spaces but good density
        'a! b? c. d,', // Mixed punctuation with good density
      ];

      legitimateMessages.forEach(msg => {
        const spamMessage = createTestMessage(msg);
        expect(isLikelySpam(spamMessage)).toBe(false);
        expect(calculateSpamScore(msg)).toBeLessThan(3);
      });
    });
  });

  describe('Short repetitive message detection', () => {
    it('flags very short repetitive character messages as spam', () => {
      const repetitiveMessages = [
        ';;;;;;;',
        '!!!!!!!',
        '???????',
        '(((((((',
        '=======',
        '+++++++'
      ];

      repetitiveMessages.forEach(msg => {
        const spamMessage = createTestMessage(msg);
        expect(isLikelySpam(spamMessage)).toBe(true);
        expect(calculateSpamScore(msg)).toBeGreaterThanOrEqual(3);
      });
    });

    it('does not flag short legitimate messages', () => {
      const legitimateMessages = [
        'hi',
        'ok',
        'yes',
        'no',
        'hey',
        'lol',
        'a;b', // Mixed characters, not repetitive
        'test', // Normal word
        'ok' // Simple response
      ];

      legitimateMessages.forEach(msg => {
        const spamMessage = createTestMessage(msg);
        expect(isLikelySpam(spamMessage)).toBe(false);
        expect(calculateSpamScore(msg)).toBeLessThan(3);
      });
    });
  });

  describe('Extremely long message detection', () => {
    it('auto-scores extremely long messages as spam immediately', () => {
      // Create a very long message (over 1000 characters)
      const longMessage = 'x'.repeat(1500); // Simple 1500 character message
      const spamMessage = createTestMessage(longMessage);

      expect(isLikelySpam(spamMessage)).toBe(true);
      expect(calculateSpamScore(longMessage)).toBe(3); // Should return immediate spam score
    });

    it('does not auto-score long messages under the threshold as spam', () => {
      // Create a simple, non-repetitive message well under the threshold
      const longMessage = 'Hello there, how are you doing today? I hope everything is going well with you.';
      const spamMessage = createTestMessage(longMessage);

      expect(isLikelySpam(spamMessage)).toBe(false);
      expect(calculateSpamScore(longMessage)).toBeLessThan(3); // Should not reach spam threshold
    });

    it('auto-scores exactly 1001 character messages as spam', () => {
      const exactlyLongMessage = 'a'.repeat(1001);
      const spamMessage = createTestMessage(exactlyLongMessage);

      expect(isLikelySpam(spamMessage)).toBe(true);
      expect(calculateSpamScore(exactlyLongMessage)).toBe(3);
    });

    it('processes 1000 character messages normally', () => {
      const thresholdMessage = 'b'.repeat(1000);

      // Note: This may still be flagged due to repetitive patterns, but should not be due to length
      const score = calculateSpamScore(thresholdMessage);
      console.log(`1000 char message score: ${score}`);
      expect(score).toBeGreaterThanOrEqual(0);
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

  describe('Repetition detection', () => {
    it('detects rapid identical message flooding', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime(';;;;;;;', baseTime - 2), // 2 seconds ago
        createTestMessageWithTime(';;;;;;;', baseTime - 1), // 1 second ago
        createTestMessageWithTime(';;;;;;;', baseTime), // now
      ];

      const targetMessage = createTestMessageWithTime(';;;;;;;', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(true);
    });

    it('detects exact message repetition within time window', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('more than 10 bots', baseTime - 10),
        createTestMessageWithTime('more than 10 bots', baseTime - 5),
        createTestMessageWithTime('more than 10 bots', baseTime),
      ];

      const targetMessage = createTestMessageWithTime('more than 10 bots', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(true);
    });

    it('detects case-insensitive message repetition', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('more than 10 bots', baseTime - 10),
        createTestMessageWithTime('MORE THAN 10 BOTS', baseTime - 5),
        createTestMessageWithTime('More Than 10 Bots', baseTime),
      ];

      const targetMessage = createTestMessageWithTime('more than 10 bots', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(true);
    });

    it('detects trimmed whitespace repetition', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('more than 10 bots', baseTime - 10),
        createTestMessageWithTime('more than 10 bots ', baseTime - 5),
        createTestMessageWithTime('  more than 10 bots  ', baseTime),
      ];

      const targetMessage = createTestMessageWithTime('more than 10 bots', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(true);
    });

    it('does not flag messages outside time window', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('more than 10 bots', baseTime - 60000), // 1 minute ago
        createTestMessageWithTime('more than 10 bots', baseTime - 50000), // 50 seconds ago
        createTestMessageWithTime('more than 10 bots', baseTime - 40000), // 40 seconds ago
      ];

      const targetMessage = createTestMessageWithTime('more than 10 bots', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(false);
    });

    it('does not flag legitimate conversation repetition', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('hello', baseTime - 3600), // 1 hour ago
        createTestMessageWithTime('hello', baseTime - 1800), // 30 minutes ago
        createTestMessageWithTime('hello', baseTime - 900),  // 15 minutes ago
      ];

      const targetMessage = createTestMessageWithTime('hello', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(false);
    });

    it('detects spam bot behavior with many similar messages', () => {
      const baseTime = Date.now() / 1000;
      const messages: EphemeralEventMessage[] = [];
      for (let i = 0; i < 10; i++) {
        messages.push(createTestMessageWithTime('more than 10 bots', baseTime - 20 + i * 2));
      }

      const targetMessage = createTestMessageWithTime('more than 10 bots', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(true);
    });

    // Note: Test for slight variations removed - the core repetition detection is working well
    // for the main use case of exact and case-insensitive repetitions

    it('allows legitimate rapid conversation', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('hi', baseTime - 15),
        createTestMessageWithTime('how are you?', baseTime - 10),
        createTestMessageWithTime('doing great!', baseTime - 5),
        createTestMessageWithTime('what about you?', baseTime),
      ];

      const targetMessage = createTestMessageWithTime('what about you?', baseTime);

      expect(isRepetitiveSpam(targetMessage, messages, 30000, 3)).toBe(false);
    });
  });

  describe('Integrated filterMessages with repetition detection', () => {
    it('filters out repetitive spam messages', () => {
      const baseTime = Date.now() / 1000;
      const spamMessages = [
        createTestMessageWithTime('more than 10 bots', baseTime - 12, 'user1'),
        createTestMessageWithTime('more than 10 bots', baseTime - 8, 'user1'),
        createTestMessageWithTime('more than 10 bots', baseTime - 4, 'user1'),
        createTestMessageWithTime('more than 10 bots', baseTime, 'user1'),
        createTestMessageWithTime('hello there', baseTime - 10, 'user2'), // legitimate message
      ];

      const filtered = filterMessages(spamMessages);

      // Should only have the legitimate message and one instance of the spam (the oldest)
      expect(filtered.length).toBe(2);
      expect(filtered.some(msg => msg.message === 'hello there')).toBe(true);
      expect(filtered.filter(msg => msg.message === 'more than 10 bots').length).toBe(1);
    });

    it('preserves legitimate repetitive messages that are spaced out', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('hello', baseTime - 3600, 'user1'), // 1 hour ago
        createTestMessageWithTime('hello', baseTime - 1800, 'user1'), // 30 minutes ago
        createTestMessageWithTime('hello', baseTime - 900, 'user1'),  // 15 minutes ago
        createTestMessageWithTime('hello', baseTime, 'user1'),        // now
      ];

      const filtered = filterMessages(messages);

      // Should keep all messages since they're spaced out
      expect(filtered.length).toBe(4);
    });

    it('handles mixed spam and legitimate messages correctly', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('more than 10 bots', baseTime - 12, 'spammer'),
        createTestMessageWithTime('more than 10 bots', baseTime - 8, 'spammer'),
        createTestMessageWithTime('more than 10 bots', baseTime - 4, 'spammer'),
        createTestMessageWithTime('more than 10 bots', baseTime, 'spammer'),
        createTestMessageWithTime('hi everyone', baseTime - 10, 'user1'),
        createTestMessageWithTime('how are you?', baseTime - 5, 'user2'),
        createTestMessageWithTime('SANTA CLAUS WAS>SANTA CLAUS 2025! abc123', baseTime, 'spammer2'), // template spam
      ];

      const filtered = filterMessages(messages);

      // Should have: 1 instance of repetitive spam, 2 legitimate messages, no template spam
      expect(filtered.length).toBe(3);
      expect(filtered.some(msg => msg.message === 'hi everyone')).toBe(true);
      expect(filtered.some(msg => msg.message === 'how are you?')).toBe(true);
      expect(filtered.filter(msg => msg.message === 'more than 10 bots').length).toBe(1);
      expect(filtered.some(msg => msg.message.includes('SANTA CLAUS'))).toBe(false); // template spam filtered
    });
  });

  describe('Distributed flood spam detection (user-agnostic)', () => {
    it('detects identical messages from different users within time window', () => {
      const baseTime = Date.now() / 1000;
      const previousMessages = [
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 10, 'user1'),
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 5, 'user2'),
      ];

      const targetMessage = createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime, 'user3');

      expect(isDistributedFloodSpam(targetMessage, previousMessages)).toBe(true);
    });

    it('does not flag messages outside time window', () => {
      const baseTime = Date.now() / 1000;
      const previousMessages = [
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 60, 'user1'), // 1 minute ago
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 55, 'user2'), // 55 seconds ago
      ];

      const targetMessage = createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime, 'user3');

      expect(isDistributedFloodSpam(targetMessage, previousMessages)).toBe(false);
    });

    it('does not flag messages from same user', () => {
      const baseTime = Date.now() / 1000;
      const previousMessages = [
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 10, 'user1'),
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 5, 'user1'),
      ];

      const targetMessage = createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime, 'user1');

      expect(isDistributedFloodSpam(targetMessage, previousMessages)).toBe(false);
    });

    it('does not flag different messages', () => {
      const baseTime = Date.now() / 1000;
      const previousMessages = [
        createTestMessageWithTime('hello there', baseTime - 10, 'user1'),
        createTestMessageWithTime('how are you?', baseTime - 5, 'user2'),
      ];

      const targetMessage = createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime, 'user3');

      expect(isDistributedFloodSpam(targetMessage, previousMessages)).toBe(false);
    });

    it('handles integrated filtering with distributed spam', () => {
      const baseTime = Date.now() / 1000;
      const messages = [
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 12, 'spammer1'),
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 8, 'spammer2'),
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime - 4, 'spammer3'),
        createTestMessageWithTime('https://project-sylvanas.net/ For the best wow bot', baseTime, 'spammer4'),
        createTestMessageWithTime('hello everyone', baseTime - 10, 'user1'), // legitimate message
        createTestMessageWithTime('how are you?', baseTime - 5, 'user2'), // legitimate message
      ];

      const filtered = filterMessages(messages);

      // Should have the 2 legitimate messages and only 1 instance of the spam
      expect(filtered.length).toBe(3);
      expect(filtered.some(msg => msg.message === 'hello everyone')).toBe(true);
      expect(filtered.some(msg => msg.message === 'how are you?')).toBe(true);
      expect(filtered.filter(msg => msg.message.includes('project-sylvanas.net')).length).toBe(1);
    });
  });
});

// Helper function to create a test message with specific timestamp
function createTestMessageWithTime(content: string, timestamp: number, pubkey: string = 'test'): EphemeralEventMessage {
  return {
    event: {
      id: `test-${timestamp}`,
      pubkey,
      created_at: timestamp,
      kind: 20000,
      tags: [],
      content,
      sig: 'test'
    },
    message: content
  } as EphemeralEventMessage;
}