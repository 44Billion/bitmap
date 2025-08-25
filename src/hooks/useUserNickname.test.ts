import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserNickname } from './useUserNickname';
import { TestApp } from '@/test/TestApp';

describe('useUserNickname', () => {
  it('should return default nickname when no stored nickname exists', () => {
    const { result } = renderHook(() => useUserNickname(), {
      wrapper: TestApp,
    });

    expect(result.current.nickname).toBe('');
  });

  it('should have working setNickname function', () => {
    const { result } = renderHook(() => useUserNickname(), {
      wrapper: TestApp,
    });

    expect(typeof result.current.setNickname).toBe('function');

    // The function should not throw when called
    expect(() => {
      act(() => {
        result.current.setNickname('testuser');
      });
    }).not.toThrow();
  });

  it('should allow editing state changes', () => {
    const { result } = renderHook(() => useUserNickname(), {
      wrapper: TestApp,
    });

    expect(result.current.isEditing).toBe(false);

    act(() => {
      result.current.setIsEditing(true);
    });

    expect(result.current.isEditing).toBe(true);
  });

  it('should have working resetToDefault function', () => {
    const { result } = renderHook(() => useUserNickname(), {
      wrapper: TestApp,
    });

    expect(typeof result.current.resetToDefault).toBe('function');

    // The function should not throw when called
    expect(() => {
      act(() => {
        result.current.resetToDefault();
      });
    }).not.toThrow();
  });
});