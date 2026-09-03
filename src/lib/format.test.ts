import { describe, expect, it } from 'vitest';
import { formatAccessCount } from './format';

describe('formatAccessCount', () => {
  it('explicitly formats numbers in 1-25 range', () => {
    expect(formatAccessCount(1)).toBe('1');
    expect(formatAccessCount(12)).toBe('12');
    expect(formatAccessCount(25)).toBe('25');
  });

  it('handles 0 and negative values gracefully', () => {
    expect(formatAccessCount(0)).toBe('0');
    expect(formatAccessCount(-5)).toBe('0');
  });

  it('formats bucket tiers above 25', () => {
    expect(formatAccessCount(26)).toBe('+25');
    expect(formatAccessCount(49)).toBe('+25');
    expect(formatAccessCount(50)).toBe('+50');
    expect(formatAccessCount(99)).toBe('+50');
    expect(formatAccessCount(100)).toBe('+100');
    expect(formatAccessCount(499)).toBe('+100');
    expect(formatAccessCount(500)).toBe('+500');
    expect(formatAccessCount(999)).toBe('+500');
    expect(formatAccessCount(1000)).toBe('+1k');
    expect(formatAccessCount(4999)).toBe('+1k');
    expect(formatAccessCount(5000)).toBe('+5k');
    expect(formatAccessCount(9999)).toBe('+5k');
    expect(formatAccessCount(10000)).toBe('+10k');
    expect(formatAccessCount(50000)).toBe('+50k');
    expect(formatAccessCount(100000)).toBe('+100k');
    expect(formatAccessCount(1000000)).toBe('+1M');
    expect(formatAccessCount(5000000)).toBe('+1M');
  });
});
