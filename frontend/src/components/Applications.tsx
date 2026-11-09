import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  GraduationCap,
  Info,
  RefreshCw,
  Timer,
  X,
} from 'lucide-react';
import {
  findNewlyExpired,
  getEffectiveStatus,
  groupApplications,
  type GroupKey,
} from '../lib/admission';
import { formatRemainingTime, getRemainingSeconds } from '../lib/time';
import type { StudentApplication } from '../types/admission';
import { buttonClass, EmptyState, LoadingState, SectionHeading, Spinner, StatusPill } from './ui';

/**
 * Current time in ms, refreshed every second. Used once per screen and passed down,
 * so every countdown shares a single timer.
 */
function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ---------- Application card ----------

interface ApplicationCardProps {
  application: StudentApplication;
  now: number;
  confirming: boolean;
  cancelling: boolean;
  onConfirm: (holdId: string) => void;
  onCancel: (holdId: string) => void;
}

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The ID stays selectable.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Application ID copied' : 'Copy application ID'}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink focus-visible:ring-2 focus-visible:ring-forest"
    >
      {copied ? <Check size={18} className="text-forest" /> : <Copy size={18} />}
    </button>
  );
}

function ApplicationCardBase({
  application,
  now,
  confirming,
  cancelling,
  onConfirm,
  onCancel,
}: ApplicationCardProps) {
  const [askRelease, setAskRelease] = useState(false);
  const status = getEffectiveStatus(application, now);
  const payable = status === 'HELD';
  const remaining = getRemainingSeconds(application.expiresAt, now);
  const urgent = remaining < 60;
  const busy = confirming || cancelling;

  // Leave the confirmation step if the hold stops being payable.
  useEffect(() => {
    if (!payable) setAskRelease(false);
  }, [payable]);

  const accent = payable
    ? urgent
      ? 'border-clay/60'
      : 'border-amber-bright/70'
    : status === 'CONFIRMED'
      ? 'border-forest/30'
      : 'border-line';

  return (
    <article className={`rounded-xl border bg-white p-3 sm:p-4 ${accent}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-forest-soft text-forest">
          <GraduationCap size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h3 className="break-words font-display text-base font-bold leading-tight">
              {application.className}
            </h3>
            <StatusPill status={status} />
          </div>
          <div className="mt-1 flex items-center gap-1">
            <p className="min-w-0 truncate text-xs text-muted">
              ID <span className="font-mono text-ink/80">{application.holdId}</span>
            </p>
            <CopyId value={application.holdId} />
          </div>
        </div>
      </div>

      {payable && (
        <div
          role="timer"
          aria-live="off"
          className={`mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
            urgent ? 'bg-clay-soft text-clay' : 'bg-amber-soft text-amber'
          }`}
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <Timer size={15} className="shrink-0" />
            {urgent ? 'Seat is about to be released' : 'Time left to pay'}
          </span>
          <span className="font-mono text-xl font-bold tabular-nums">
            {formatRemainingTime(remaining)}
          </span>
        </div>
      )}

      <div className="mt-3">
        {payable && askRelease ? (
          <div className="rounded-lg bg-paper p-3">
            <p className="text-sm font-semibold">Release this seat?</p>
            <p className="mt-1 text-xs text-muted">Someone else may take it right away.</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                className={buttonClass('quiet', 'sm:flex-1', 'md')}
                onClick={() => setAskRelease(false)}
                disabled={cancelling}
              >
                Keep seat
              </button>
              <button
                className={buttonClass('dark', 'sm:flex-1', 'md')}
                onClick={() => onCancel(application.holdId)}
                disabled={cancelling}
              >
                {cancelling ? <Spinner /> : <X size={18} />} Release seat
              </button>
            </div>
          </div>
        ) : payable ? (
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
            <button
              className={buttonClass('primary', 'sm:w-auto', 'md')}
              onClick={() => onConfirm(application.holdId)}
              disabled={busy}
            >
              {confirming ? <Spinner size={16} /> : <CreditCard size={17} />} Pay admission fee
            </button>
            <button
              className={buttonClass('quiet', 'sm:w-auto', 'md')}
              onClick={() => setAskRelease(true)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        ) : status === 'CONFIRMED' ? (
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-dark">
            <CheckCircle2 size={18} /> Admission secured
          </p>
        ) : (
          <p className="text-sm text-muted">
            {status === 'EXPIRED'
              ? 'The hold expired and the seat was released. You can apply again from Classes.'
              : 'This application was cancelled.'}
          </p>
        )}
      </div>
    </article>
  );
}

export const ApplicationCard = memo(ApplicationCardBase);

// ---------- Applications screen ----------

type Filter = 'all' | GroupKey;

const sections: { key: GroupKey; title: string; hint: string }[] = [
  {
    key: 'action',
    title: 'Needs payment',
    hint: 'Pay before the timer ends or the seat is released.',
  },
  { key: 'confirmed', title: 'Confirmed', hint: 'These admissions are secured.' },
  { key: 'closed', title: 'Closed', hint: 'Expired or cancelled applications.' },
];

const filterLabels: Record<Filter, string> = {
  all: 'All',
  action: 'Needs payment',
  confirmed: 'Confirmed',
  closed: 'Closed',
};

interface ApplicationsViewProps {
  studentReady: boolean;
  applications: StudentApplication[];
  isLoading: boolean;
  error: Error | null;
  confirmingId?: string;
  cancellingId?: string;
  onConfirm: (holdId: string) => void;
  onCancel: (holdId: string) => void;
  /** Called once when a hold runs out locally, so the list can be re-fetched. */
  onHoldExpired: () => void;
  onRetry: () => void;
  onBrowse: () => void;
}

export function ApplicationsView({
  studentReady,
  applications,
  isLoading,
  error,
  confirmingId,
  cancellingId,
  onConfirm,
  onCancel,
  onHoldExpired,
  onRetry,
  onBrowse,
}: ApplicationsViewProps) {
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const reported = useRef(new Set<string>());

  const groups = useMemo(() => groupApplications(applications, now), [applications, now]);

  useEffect(() => {
    const expired = findNewlyExpired(applications, now, reported.current);
    if (expired.length === 0) return;
    expired.forEach((id) => reported.current.add(id));
    onHoldExpired();
  }, [applications, now, onHoldExpired]);

  const counts: Record<Filter, number> = {
    all: applications.length,
    action: groups.action.length,
    confirmed: groups.confirmed.length,
    closed: groups.closed.length,
  };
  const visible = sections.filter(
    (s) => (filter === 'all' || filter === s.key) && groups[s.key].length > 0
  );

  let body;
  if (!studentReady) {
    body = (
      <EmptyState
        title="Enter your registration number"
        description="Save your 17-digit birth registration number above and your applications will load here."
      />
    );
  } else if (isLoading) {
    body = <LoadingState label="Loading your applications…" />;
  } else if (error) {
    body = (
      <EmptyState
        title="Applications could not be loaded"
        description={error.message || 'Please try again.'}
        action={
          <button className={buttonClass('secondary')} onClick={onRetry}>
            <RefreshCw size={16} /> Try again
          </button>
        }
      />
    );
  } else if (applications.length === 0) {
    body = (
      <EmptyState
        title="No applications yet"
        description="When you reserve a seat, it appears here with its status and a payment timer."
        action={
          <button className={buttonClass('primary')} onClick={onBrowse}>
            Browse classes <ArrowRight size={16} />
          </button>
        }
      />
    );
  } else {
    body = (
      <>
        <div
          role="group"
          aria-label="Filter applications"
          className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0"
        >
          {(Object.keys(filterLabels) as Filter[]).map((key) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(key)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${
                  active
                    ? 'border-forest bg-forest text-white'
                    : 'border-line bg-white text-ink hover:bg-paper'
                }`}
              >
                {filterLabels[key]}
                <span
                  className={`rounded-full px-2 py-0.5 text-sm tabular-nums ${
                    active ? 'bg-white/20' : 'bg-paper'
                  }`}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
            Nothing in &ldquo;{filterLabels[filter]}&rdquo; right now.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {visible.map(({ key, title, hint }) => (
              <section
                key={key}
                aria-labelledby={`apps-${key}`}
                className={key === 'action' ? 'md:col-span-2' : ''}
              >
                <div className="mb-2">
                  <h3 id={`apps-${key}`} className="font-display text-lg font-bold">
                    {title}{' '}
                    <span className="ml-1 font-sans text-sm font-medium text-muted">
                      {groups[key].length}
                    </span>
                  </h3>
                  <p className="mt-1 text-xs text-muted">{hint}</p>
                </div>
                <div className="grid gap-3">
                  {groups[key].map((application) => (
                    <ApplicationCard
                      key={application.holdId}
                      application={application}
                      now={now}
                      confirming={confirmingId === application.holdId}
                      cancelling={cancellingId === application.holdId}
                      onConfirm={onConfirm}
                      onCancel={onCancel}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-7 flex items-start gap-2 text-xs text-muted">
          <Info size={15} className="mt-0.5 shrink-0" />
          The fee step is simulated for this assignment. No real payment is collected.
        </p>
      </>
    );
  }

  return (
    <section>
      <SectionHeading
        title="Application history"
        description="Pay the admission fee before the timer runs out to keep your seat."
        aside={studentReady ? `${applications.length} total` : undefined}
      />
      {body}
    </section>
  );
}
