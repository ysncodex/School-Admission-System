import { describe, expect, it } from 'vitest';
import {
  allocateCells,
  findNewlyExpired,
  getEffectiveStatus,
  groupApplications,
} from './admission';
import type { StudentApplication } from '../types/admission';

const NOW = Date.parse('2026-11-09T00:00:00.000Z');
const at = (seconds: number) => new Date(NOW + seconds * 1000).toISOString();
const app = (
  holdId: string,
  status: StudentApplication['status'],
  expiresIn: number
): StudentApplication => ({
  holdId,
  classId: 'c1',
  className: 'Class 6',
  status,
  expiresAt: at(expiresIn),
});

describe('getEffectiveStatus', () => {
  it('treats a HELD application past its deadline as EXPIRED', () => {
    expect(getEffectiveStatus(app('a', 'HELD', -1), NOW)).toBe('EXPIRED');
    expect(getEffectiveStatus(app('a', 'HELD', 30), NOW)).toBe('HELD');
  });

  it('never changes a confirmed application', () => {
    expect(getEffectiveStatus(app('a', 'CONFIRMED', -500), NOW)).toBe('CONFIRMED');
  });
});

describe('groupApplications', () => {
  it('splits by next action and puts the most urgent hold first', () => {
    const groups = groupApplications(
      [
        app('late', 'HELD', 500),
        app('soon', 'HELD', 20),
        app('paid', 'CONFIRMED', -100),
        app('gone', 'CANCELLED', -50),
        app('timed-out', 'HELD', -5),
      ],
      NOW
    );
    expect(groups.action.map((a) => a.holdId)).toEqual(['soon', 'late']);
    expect(groups.confirmed.map((a) => a.holdId)).toEqual(['paid']);
    expect(groups.closed.map((a) => a.holdId)).toEqual(['timed-out', 'gone']);
  });
});

describe('findNewlyExpired', () => {
  it('reports each expired hold only once', () => {
    const apps = [app('a', 'HELD', -1), app('b', 'HELD', 60)];
    expect(findNewlyExpired(apps, NOW, new Set())).toEqual(['a']);
    expect(findNewlyExpired(apps, NOW, new Set(['a']))).toEqual([]);
  });
});

describe('allocateCells', () => {
  it('shows everything open when nothing is taken', () => {
    expect(allocateCells(0, 0, 100, 40)).toEqual({ confirmed: 0, held: 0, open: 40 });
  });

  it('fills every cell when the class is full', () => {
    expect(allocateCells(60, 0, 60, 60)).toEqual({ confirmed: 60, held: 0, open: 0 });
  });

  it('keeps a tiny count visible', () => {
    const result = allocateCells(1, 1, 1000, 40);
    expect(result.confirmed).toBe(1);
    expect(result.held).toBe(1);
  });

  it('keeps one cell open while seats remain', () => {
    const result = allocateCells(999, 0, 1000, 40);
    expect(result.open).toBe(1);
    expect(result.confirmed + result.held + result.open).toBe(40);
  });

  it('handles a class with no seats', () => {
    expect(allocateCells(0, 0, 0, 10)).toEqual({ confirmed: 0, held: 0, open: 10 });
  });

  it('never exceeds the cell count when data is inconsistent', () => {
    const r = allocateCells(90, 90, 100, 20);
    expect(r.confirmed + r.held + r.open).toBe(20);
    expect(r.open).toBeGreaterThanOrEqual(0);
  });
});
