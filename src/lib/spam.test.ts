import { describe, it, expect } from 'vitest';
import { isLikelySpam } from './utils';
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

  describe('Legitimate messages should not be flagged', () => {
    it('does not flag normal conversation', () => {
      const legitimateMessages = [
        'hello there',
        'How are you doing today?',
        'Check out this cool thing I found!',
        'Thanks for the help!',
        'Anyone want to chat?',
        'This is a longer message that should not be flagged as spam because it looks like normal conversation',
        'Hello! How are you?',
        'Meeting at 3pm > conference room',
        'Error code: 404'
      ];

      legitimateMessages.forEach(msg => {
        expect(isLikelySpam(createTestMessage(msg))).toBe(false);
      });
    });

    it('does not flag messages with random strings that look legitimate', () => {
      const legitimateMessages = [
        'My meeting ID is abc123',
        'Reference: def456',
        'Ticket number: ghi789'
      ];

      legitimateMessages.forEach((msg, index) => {
        const result = isLikelySpam(createTestMessage(msg));
        console.log(`Message ${index}: "${msg}" -> ${result}`);
        expect(result).toBe(false);
      });
    });
  });

  describe('Pattern edge cases', () => {
    it('detects spam with exactly 6 character random suffix', () => {
      const spamMessage = createTestMessage('BOT MESSAGE>SPAM! 123456');
      expect(isLikelySpam(spamMessage)).toBe(true);
    });

    it('does not flag short messages with random suffixes', () => {
      const shortMessage = createTestMessage('Hi! abc123');
      expect(isLikelySpam(shortMessage)).toBe(false);
    });

    it('detects spam with special characters and random suffix', () => {
      const spamMessage = createTestMessage('SPAM#MESSAGE! xyz789');
      expect(isLikelySpam(spamMessage)).toBe(true);
    });
  });
});