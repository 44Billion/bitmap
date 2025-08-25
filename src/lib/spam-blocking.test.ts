import { describe, it, expect } from 'vitest';
import { isLikelySpam, filterMessages } from './utils';
import type { EphemeralEventMessage } from '@/hooks/useChatSession';

// Mock EphemeralEventMessage for testing
function createMockMessage(content: string, pubkey: string): EphemeralEventMessage {
  return {
    event: {
      id: 'test-id',
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 20000,
      tags: [],
      content: content,
      sig: 'test-sig',
    },
    message: content,
    nickname: 'test-user',
  };
}

describe('Spam Blocking Integration', () => {
  it('filters out messages from blocked users', () => {
    const blockedUsers = ['blocked-user-1', 'blocked-user-2'];
    const messages = [
      createMockMessage('Hello from user1', 'user1'),
      createMockMessage('Spam from blocked user', 'blocked-user-1'),
      createMockMessage('Normal message', 'user2'),
      createMockMessage('Another spam message', 'blocked-user-2'),
    ];

    const filtered = filterMessages(messages, blockedUsers);

    // Should only contain messages from non-blocked users
    expect(filtered).toHaveLength(2);
    expect(filtered.map(m => m.event.pubkey)).toEqual(['user1', 'user2']);
    expect(filtered.map(m => m.message)).toEqual(['Hello from user1', 'Normal message']);
  });

  it('considers blocked users as spam in isLikelySpam', () => {
    const blockedUsers = ['blocked-pubkey'];
    const message = createMockMessage('This is a normal message', 'blocked-pubkey');

    // Should be considered spam because user is blocked
    expect(isLikelySpam(message, blockedUsers)).toBe(true);
  });

  it('does not affect non-blocked users', () => {
    const blockedUsers = ['other-user'];
    const message = createMockMessage('This is a normal message', 'normal-user');

    // Should not be considered spam because user is not blocked
    expect(isLikelySpam(message, blockedUsers)).toBe(false);
  });

  it('works with empty blocked users list', () => {
    const blockedUsers: string[] = [];
    const messages = [
      createMockMessage('Hello from user1', 'user1'),
      createMockMessage('Hello from user2', 'user2'),
    ];

    const filtered = filterMessages(messages, blockedUsers);

    // Should contain all messages when no users are blocked
    expect(filtered).toHaveLength(2);
    expect(filtered.map(m => m.event.pubkey)).toEqual(['user1', 'user2']);
  });

  it('combines blocking with other spam detection', () => {
    const blockedUsers = ['blocked-user'];
    const messages = [
      createMockMessage('Normal message', 'user1'),
      createMockMessage('SPAM!!!!!!!', 'user2'), // This should be caught by spam detection
      createMockMessage('Message from blocked user', 'blocked-user'), // This should be caught by blocking
    ];

    const filtered = filterMessages(messages, blockedUsers);

    // Should only contain the legitimate message
    expect(filtered).toHaveLength(1);
    expect(filtered[0].event.pubkey).toBe('user1');
    expect(filtered[0].message).toBe('Normal message');
  });
});