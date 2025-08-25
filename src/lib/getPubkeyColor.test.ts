import { describe, it, expect } from 'vitest';
import { getPubkeyColor } from './getPubkeyColor';

describe('getPubkeyColor', () => {
  it('returns a default color for empty pubkey', () => {
    expect(getPubkeyColor('')).toBe('#6b7280');
    expect(getPubkeyColor(undefined as unknown as string)).toBe('#6b7280');
  });

  it('returns consistent colors for the same pubkey', () => {
    const pubkey = 'test_pubkey_123';
    const color1 = getPubkeyColor(pubkey);
    const color2 = getPubkeyColor(pubkey);
    expect(color1).toBe(color2);
  });

  it('returns different colors for different pubkeys', () => {
    const pubkey1 = 'test_pubkey_123';
    const pubkey2 = 'different_pubkey_456';
    const color1 = getPubkeyColor(pubkey1);
    const color2 = getPubkeyColor(pubkey2);
    expect(color1).not.toBe(color2);
  });

  it('returns valid HSL color format', () => {
    const pubkey = 'test_pubkey_123';
    const color = getPubkeyColor(pubkey);
    expect(color).toMatch(/^hsl\(\d+, 70%, 60%\)$/);
  });

  it('generates colors within valid hue range', () => {
    const pubkey = 'test_pubkey_123';
    const color = getPubkeyColor(pubkey);
    const match = color.match(/hsl\((\d+), 70%, 60%\)/);
    expect(match).toBeTruthy();
    if (match) {
      const hue = parseInt(match[1]);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(359);
    }
  });
});