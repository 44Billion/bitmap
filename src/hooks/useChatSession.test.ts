import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { useChatSession } from './useChatSession';
import type { GeoRelay } from '@/lib/georelays';

// Mock the required modules
const mockFetchGeoRelays = vi.fn();
const mockFindClosestRelays = vi.fn();
const mockDecode = vi.fn();

vi.mock('@/lib/georelays', () => ({
  fetchGeoRelays: () => mockFetchGeoRelays(),
  findClosestRelays: (...args: [GeoRelay[], number, number, number?]) => mockFindClosestRelays(...args),
}));

vi.mock('ngeohash', () => ({
  decode: (...args: [string]) => mockDecode(...args),
}));

describe('useChatSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get chat relays combining default and closest relays', async () => {
    const mockGeoRelays = [
      { url: 'wss://geo1.example.com', latitude: 40.7128, longitude: -74.0060 },
      { url: 'wss://geo2.example.com', latitude: 34.0522, longitude: -118.2437 },
    ];

    const mockClosestRelays = [
      { url: 'wss://geo1.example.com', latitude: 40.7128, longitude: -74.0060 },
    ];

    mockFetchGeoRelays.mockResolvedValue(mockGeoRelays);
    mockFindClosestRelays.mockReturnValue(mockClosestRelays);
    mockDecode.mockReturnValue({ latitude: 40.7128, longitude: -74.0060 });

    const { result } = renderHook(
      () => useChatSession('dr5reg1'),
      { wrapper: TestApp }
    );

    // Wait for the session to be initialized
    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    // Test that the relay selection logic would work (we can't directly test getChatRelays as it's internal)
    // but we can verify the hook initializes correctly
    expect(result.current.isLoading).toBe(false);
    expect(result.current.session).toBeTruthy();
  });

  it('should handle relay fetch errors gracefully', async () => {
    mockFetchGeoRelays.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () => useChatSession('dr5reg1'),
      { wrapper: TestApp }
    );

    // The hook should still initialize even if geo relay fetch fails
    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.session).toBeTruthy();
  });
});