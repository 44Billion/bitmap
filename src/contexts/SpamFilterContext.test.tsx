import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpamFilterProvider, useSpamFilter } from './SpamFilterContext';
import { TestApp } from '@/test/TestApp';

// Test component to use the hook
function TestComponent() {
  const {
    spamFilterEnabled,
    toggleSpamFilter,
    blockedUsers,
    blockUser,
    unblockUser,
    isUserBlocked
  } = useSpamFilter();

  return (
    <div>
      <div data-testid="spam-filter-enabled">{spamFilterEnabled.toString()}</div>
      <div data-testid="blocked-users-count">{blockedUsers.length}</div>
      <div data-testid="user1-blocked">{isUserBlocked('user1').toString()}</div>
      <div data-testid="user2-blocked">{isUserBlocked('user2').toString()}</div>
      <button onClick={toggleSpamFilter} data-testid="toggle-spam-filter">
        Toggle Spam Filter
      </button>
      <button onClick={() => blockUser('user1')} data-testid="block-user1">
        Block User 1
      </button>
      <button onClick={() => blockUser('user2')} data-testid="block-user2">
        Block User 2
      </button>
      <button onClick={() => unblockUser('user1')} data-testid="unblock-user1">
        Unblock User 1
      </button>
    </div>
  );
}

describe('SpamFilterContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });
  it('provides initial state', () => {
    render(
      <TestApp>
        <SpamFilterProvider>
          <TestComponent />
        </SpamFilterProvider>
      </TestApp>
    );

    expect(screen.getByTestId('spam-filter-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('0');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('false');
    expect(screen.getByTestId('user2-blocked')).toHaveTextContent('false');
  });

  it('toggles spam filter', () => {
    render(
      <TestApp>
        <SpamFilterProvider>
          <TestComponent />
        </SpamFilterProvider>
      </TestApp>
    );

    const toggleButton = screen.getByTestId('toggle-spam-filter');

    // Initially enabled
    expect(screen.getByTestId('spam-filter-enabled')).toHaveTextContent('true');

    // Toggle to disabled
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('spam-filter-enabled')).toHaveTextContent('false');

    // Toggle back to enabled
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('spam-filter-enabled')).toHaveTextContent('true');
  });

  it('blocks and unblocks users', () => {
    render(
      <TestApp>
        <SpamFilterProvider>
          <TestComponent />
        </SpamFilterProvider>
      </TestApp>
    );

    // Initially no users blocked
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('0');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('false');
    expect(screen.getByTestId('user2-blocked')).toHaveTextContent('false');

    // Block user 1
    fireEvent.click(screen.getByTestId('block-user1'));
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('1');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('true');
    expect(screen.getByTestId('user2-blocked')).toHaveTextContent('false');

    // Block user 2
    fireEvent.click(screen.getByTestId('block-user2'));
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('2');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('true');
    expect(screen.getByTestId('user2-blocked')).toHaveTextContent('true');

    // Unblock user 1
    fireEvent.click(screen.getByTestId('unblock-user1'));
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('1');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('false');
    expect(screen.getByTestId('user2-blocked')).toHaveTextContent('true');
  });

  it('does not block the same user twice', () => {
    render(
      <TestApp>
        <SpamFilterProvider>
          <TestComponent />
        </SpamFilterProvider>
      </TestApp>
    );

    // Block user 1 twice
    fireEvent.click(screen.getByTestId('block-user1'));
    fireEvent.click(screen.getByTestId('block-user1'));

    // Should still only have 1 blocked user
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('1');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('true');
  });

  it('does not unblock a user that is not blocked', () => {
    render(
      <TestApp>
        <SpamFilterProvider>
          <TestComponent />
        </SpamFilterProvider>
      </TestApp>
    );

    // Try to unblock user 1 when not blocked
    fireEvent.click(screen.getByTestId('unblock-user1'));

    // Should still have 0 blocked users
    expect(screen.getByTestId('blocked-users-count')).toHaveTextContent('0');
    expect(screen.getByTestId('user1-blocked')).toHaveTextContent('false');
  });
});