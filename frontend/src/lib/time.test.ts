import { describe, expect, it } from 'vitest';
import { formatRemainingTime, getRemainingSeconds } from './time';

describe('reservation countdown helpers', () => {
  it('formats minutes and seconds', () => {
    expect(formatRemainingTime(600)).toBe('10:00');
    expect(formatRemainingTime(61)).toBe('01:01');
    expect(formatRemainingTime(-5)).toBe('00:00');
  });

  it('calculates the remaining time without returning a negative value', () => {
    expect(
      getRemainingSeconds('2026-11-09T00:10:00.000Z', Date.parse('2026-11-09T00:00:00.000Z'))
    ).toBe(600);
    expect(
      getRemainingSeconds('2026-11-09T00:00:00.000Z', Date.parse('2026-11-09T00:00:01.000Z'))
    ).toBe(0);
  });
});
