import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { highlightMentions } from './highlightMentions';
import { TestApp } from '@/test/TestApp';

describe('highlightMentions', () => {
  // Create proper mock data that matches the actual patterns
  const mockMessages = [
    {
      event: { pubkey: 'test_pubkey_1234567890abcdef1234567890abcdef' },
      nickname: 'alice'
    },
    {
      event: { pubkey: 'another_pubkey_1234567890abcdef1234567890abcde' },
      nickname: 'bob'
    },
  ];

  it('returns original message when no mentions are found', () => {
    const message = 'Hello world, how are you?';
    const result = highlightMentions(message, []);

    expect(result).toBe(message);
  });

  it('highlights single mention correctly', () => {
    const message = 'Hey alice#cdef, how are you?';
    const result = highlightMentions(message, mockMessages);

    // The result should be different from the original message
    expect(result).not.toBe(message);

    // The result should be renderable and contain the mention
    const { container } = render(<TestApp>{result}</TestApp>);
    expect(container.textContent).toContain('alice#cdef');
  });

  it('handles multiple mentions in one message', () => {
    const message = 'alice#cdef and bob#bcde are here';
    const result = highlightMentions(message, mockMessages);

    expect(result).not.toBe(message);

    // The result should be renderable and contain both mentions
    const { container } = render(<TestApp>{result}</TestApp>);
    expect(container.textContent).toContain('alice#cdef');
    expect(container.textContent).toContain('bob#bcde');
  });

  it('handles empty message', () => {
    const message = '';
    const result = highlightMentions(message, mockMessages);

    expect(result).toBe(message);
  });

  it('handles messages with no users', () => {
    const message = 'Hello world';
    const result = highlightMentions(message, []);

    expect(result).toBe(message);
  });

  it('includes current user in mentions', () => {
    const message = 'user#1234 is here';
    const currentUserPubkey = 'current_user_pubkey1234567890abcdef1234567890';
    const result = highlightMentions(message, [], currentUserPubkey);

    expect(result).not.toBe(message);

    // The result should be renderable and contain the mention
    const { container } = render(<TestApp>{result}</TestApp>);
    expect(container.textContent).toContain('user#1234');
  });

  it('renders highlighted mentions with proper styling', () => {
    const message = 'alice#cdef is here';
    const result = highlightMentions(message, mockMessages);

    if (React.isValidElement(result)) {
      const { container } = render(<TestApp>{result}</TestApp>);

      // Check that the mention is rendered as a span with color styling
      const span = container.querySelector('span[style]');
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('alice#cdef');
    }
  });

  it('preserves text around mentions', () => {
    const message = 'Hello alice#cdef, how are you?';
    const result = highlightMentions(message, mockMessages);

    if (React.isValidElement(result)) {
      const { container } = render(<TestApp>{result}</TestApp>);

      // Check that the text around the mention is preserved
      expect(container.textContent).toContain('Hello ');
      expect(container.textContent).toContain('alice#cdef');
      expect(container.textContent).toContain(', how are you?');
    }
  });
});