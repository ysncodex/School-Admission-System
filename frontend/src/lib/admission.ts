import { getRemainingSeconds } from './time';
import type { ApplicationStatus, StudentApplication } from '../types/admission';

export type GroupKey = 'action' | 'confirmed' | 'closed';
export type ApplicationGroups = Record<GroupKey, StudentApplication[]>;

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

export interface SeatCells {
  confirmed: number;
  held: number;
  open: number;
}

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
