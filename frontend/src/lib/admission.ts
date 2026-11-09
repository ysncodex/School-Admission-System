import { getRemainingSeconds } from './time';
import type { ApplicationStatus, StudentApplication } from '../types/admission';

// ---------- Applications: status, grouping, expiry ----------

export type GroupKey = 'action' | 'confirmed' | 'closed';
export type ApplicationGroups = Record<GroupKey, StudentApplication[]>;

/** A HELD application whose timer has run out is EXPIRED, even before the server says so. */
export function getEffectiveStatus(app: StudentApplication, now: number): ApplicationStatus {
  return app.status === 'HELD' && getRemainingSeconds(app.expiresAt, now) <= 0
    ? 'EXPIRED'
    : app.status;
}

export function isPayable(app: StudentApplication, now: number): boolean {
  return getEffectiveStatus(app, now) === 'HELD';
}

const byExpiry = (a: StudentApplication, b: StudentApplication) =>
  new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();

/**
 * Groups applications by what the student needs to do next.
 * - action: payable holds, soonest expiry first (most urgent on top)
 * - confirmed / closed: most recent first
 */
export function groupApplications(apps: StudentApplication[], now: number): ApplicationGroups {
  const groups: ApplicationGroups = { action: [], confirmed: [], closed: [] };
  for (const app of apps) {
    const status = getEffectiveStatus(app, now);
    if (status === 'HELD') groups.action.push(app);
    else if (status === 'CONFIRMED') groups.confirmed.push(app);
    else groups.closed.push(app);
  }
  groups.action.sort(byExpiry);
  groups.confirmed.sort((a, b) => byExpiry(b, a));
  groups.closed.sort((a, b) => byExpiry(b, a));
  return groups;
}

/** Ids of holds that just ran out locally and have not been reported yet. */
export function findNewlyExpired(
  apps: StudentApplication[],
  now: number,
  alreadyReported: ReadonlySet<string>
): string[] {
  return apps
    .filter(
      (app) =>
        app.status === 'HELD' &&
        getRemainingSeconds(app.expiresAt, now) <= 0 &&
        !alreadyReported.has(app.holdId)
    )
    .map((app) => app.holdId);
}

// ---------- Seats: map real counts onto a visual seat grid ----------

export interface SeatCells {
  confirmed: number;
  held: number;
  open: number;
}

/**
 * Turns real seat counts into a fixed number of visual cells.
 * - Any non-zero count always gets at least one cell, so small numbers stay visible.
 * - While real seats remain, at least one cell stays open, so a nearly full class never looks full.
 */
export function allocateCells(
  confirmed: number,
  held: number,
  total: number,
  cells: number
): SeatCells {
  if (cells <= 0) return { confirmed: 0, held: 0, open: 0 };
  if (total <= 0) return { confirmed: 0, held: 0, open: cells };

  let c = Math.round((confirmed / total) * cells);
  let h = Math.round((held / total) * cells);
  if (confirmed > 0) c = Math.max(c, 1);
  if (held > 0) h = Math.max(h, 1);
  c = Math.min(c, cells);
  h = Math.min(h, cells - c);

  if (confirmed + held < total && c + h >= cells) {
    if (c >= h && c > 0) c -= 1;
    else h -= 1;
  }
  return { confirmed: c, held: h, open: cells - c - h };
}
