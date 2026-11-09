import { useState, type FormEvent } from 'react';
import { ArrowDown, CheckCircle2, GraduationCap, UserRound } from 'lucide-react';
import { isValidStudentId } from '../lib/student';
import type { AdmissionClass } from '../types/admission';
import { buttonClass, Spinner } from './ui';

// ---------- Hero ----------

interface HeroProps {
  classes: AdmissionClass[];
  onBrowse: () => void;
}

export function Hero({ classes, onBrowse }: HeroProps) {
  const totals = classes.reduce(
    (sum, c) => ({
      total: sum.total + c.totalSeats,
      held: sum.held + c.heldSeats,
      confirmed: sum.confirmed + c.confirmedSeats,
      open: sum.open + c.availableSeats,
    }),
    { total: 0, held: 0, confirmed: 0, open: 0 }
  );

  return (
    <section className="rounded-xl bg-forest-dark px-5 py-6 text-white sm:px-7 sm:py-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(24rem,1fr)] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest-mint">
            Admissions open for 2026–27
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight">
            Reserve your seat at Northstar School.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
            Pick a class, hold your seat while you pay the admission fee, and you are in. Seats go
            in the order people apply.
          </p>
          <button
            className={buttonClass('light', 'mt-4 w-full sm:w-auto', 'md')}
            onClick={onBrowse}
          >
            Browse classes <ArrowDown size={20} />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-white/15 pt-4 sm:grid-cols-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {[
            ['Seats open', totals.open, 'text-forest-mint'],
            ['Confirmed', totals.confirmed, 'text-white'],
            ['On hold', totals.held, 'text-amber-bright'],
            ['Classes', classes.length, 'text-white'],
          ].map(([label, value, color]) => (
            <div key={label as string}>
              <dd className={`font-display text-2xl font-bold tabular-nums ${color}`}>
                {value}
              </dd>
              <dt className="mt-0.5 text-xs text-white/70">{label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------- Student identification ----------

interface IdentityPanelProps {
  studentId: string;
  /** Returns true when the number was valid and saved. */
  onSave: (raw: string) => boolean;
}

export function IdentityPanel({ studentId, onSave }: IdentityPanelProps) {
  const ready = isValidStudentId(studentId);
  const [editing, setEditing] = useState(!ready);
  const [draft, setDraft] = useState(studentId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSave(draft)) setEditing(false);
  };

  if (ready && !editing) {
    return (
      <section
        aria-label="Student identification"
        className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 sm:p-3.5"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-forest-soft text-forest">
          <CheckCircle2 size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Registration number saved</p>
          <p className="truncate font-mono text-xs text-muted">
            {'•'.repeat(13)}
            {studentId.slice(-4)}
          </p>
        </div>
        <button
          className={buttonClass('quiet', 'min-h-9 px-3 text-sm')}
          onClick={() => {
            setDraft(studentId);
            setEditing(true);
          }}
        >
          Change
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Student identification"
      className="rounded-xl border border-line bg-white p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-forest-soft text-forest">
            <UserRound size={22} />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Start with your registration number</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
              Your 17-digit birth registration number. It stays in this browser and is only sent
              with your admission requests.
            </p>
          </div>
        </div>

        <form className="w-full lg:max-w-md" onSubmit={submit}>
          <label className="sr-only" htmlFor="student-id">
            Birth registration number
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="student-id"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 17))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="17-digit number"
              maxLength={17}
              aria-describedby="student-id-count"
              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-paper px-3 font-mono text-base tracking-wider text-ink outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted/60 focus:border-forest focus:bg-white focus:ring-4 focus:ring-forest/15"
            />
            <div className="flex gap-3">
              <button type="submit" className={buttonClass('dark', 'flex-1 sm:flex-none', 'md')}>
                Save
              </button>
              {ready && (
                <button
                  type="button"
                  className={buttonClass('quiet', 'flex-1 sm:flex-none', 'md')}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <p
            id="student-id-count"
            aria-live="polite"
            className="mt-2 text-xs tabular-nums text-muted"
          >
            {draft.length} of 17 digits
          </p>
        </form>
      </div>
    </section>
  );
}

// ---------- Class card ----------

interface ClassCardProps {
  item: AdmissionClass;
  studentReady: boolean;
  pending: boolean;
  onApply: (classId: string) => void;
}

export function ClassCard({ item, studentReady, pending, onApply }: ClassCardProps) {
  const isFull = item.availableSeats <= 0;
  const fillingFast =
    !isFull && item.totalSeats > 0 && item.availableSeats / item.totalSeats <= 0.2;

  const badge = isFull
    ? { text: 'Fully booked', cls: 'bg-clay-soft text-clay' }
    : fillingFast
      ? { text: 'Filling fast', cls: 'bg-amber-soft text-amber' }
      : { text: 'Open', cls: 'bg-forest-soft text-forest-dark' };

  return (
    <article className="flex flex-col rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-forest-soft text-forest">
          <GraduationCap size={19} strokeWidth={1.8} />
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
          {badge.text}
        </span>
      </div>

      <h3 className="mt-4 break-words font-display text-lg font-bold leading-tight">{item.name}</h3>

      <p className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-display text-2xl font-bold leading-none tabular-nums ${
            isFull ? 'text-clay' : 'text-ink'
          }`}
        >
          {item.availableSeats}
        </span>
        <span className="text-sm text-muted">
          {item.availableSeats === 1 ? 'seat' : 'seats'} left of {item.totalSeats}
        </span>
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
        <div>
          <dt className="text-muted">Confirmed</dt>
          <dd className="mt-0.5 font-semibold text-ink">{item.confirmedSeats}</dd>
        </div>
        <div>
          <dt className="text-muted">On hold</dt>
          <dd className="mt-0.5 font-semibold text-ink">{item.heldSeats}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-3">
        <button
          className={buttonClass('primary', 'w-full', 'md')}
          disabled={isFull || !studentReady || pending}
          onClick={() => onApply(item.id)}
        >
          {pending ? <Spinner /> : null}
          {isFull ? 'Fully booked' : pending ? 'Reserving…' : 'Reserve a seat'}
        </button>
        {!studentReady && !isFull && (
          <p className="mt-2 text-center text-xs text-muted">
            Save your registration number first to reserve.
          </p>
        )}
      </div>
    </article>
  );
}
