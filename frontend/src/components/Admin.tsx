import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUpDown, Plus } from 'lucide-react';
import type { AdmissionClass } from '../types/admission';
import { buttonClass, SeatField, SeatLegend, SectionHeading, Spinner } from './ui';

interface AdminViewProps {
  classes: AdmissionClass[];
  pending: boolean;
  liveStatus: 'connected' | 'syncing' | 'disconnected';
  onCreate: (name: string, totalSeats: string) => Promise<boolean>;
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-forest focus:bg-white focus:ring-4 focus:ring-forest/15';

function Fill({ c }: { c: AdmissionClass }) {
  return (
    <SeatField
      confirmed={c.confirmedSeats}
      held={c.heldSeats}
      total={c.totalSeats}
      cells={20}
      cols={20}
      className="min-w-40"
    />
  );
}

type SortKey = 'name' | 'totalSeats' | 'heldSeats' | 'confirmedSeats' | 'availableSeats';

export function AdminView({ classes, pending, onCreate, liveStatus }: AdminViewProps) {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('120');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAscending, setSortAscending] = useState(true);
  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const result =
          typeof left === 'string' && typeof right === 'string'
            ? left.localeCompare(right)
            : Number(left) - Number(right);
        return sortAscending ? result : -result;
      }),
    [classes, sortAscending, sortKey]
  );

  const changeSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) setSortAscending((current) => !current);
    else {
      setSortKey(nextKey);
      setSortAscending(true);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await onCreate(name, seats)) {
      setName('');
      setSeats('120');
    }
  };

  const totals = classes.reduce(
    (s, c) => ({
      open: s.open + c.availableSeats,
      held: s.held + c.heldSeats,
      confirmed: s.confirmed + c.confirmedSeats,
      total: s.total + c.totalSeats,
    }),
    { open: 0, held: 0, confirmed: 0, total: 0 }
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-bold">Add a class or shift</h2>
          <p className="mb-6 mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
            Each class and shift has its own seats and its own first-come, first-served queue.
          </p>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-1.5">
              <label htmlFor="class-name" className="text-sm font-semibold">
                Class and shift name
              </label>
              <input
                id="class-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Class 6 - Morning Shift"
                maxLength={100}
                minLength={3}
                required
              />
              <p className="text-xs text-muted">Include the shift name.</p>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="seat-capacity" className="text-sm font-semibold">
                Total seats
              </label>
              <input
                id="seat-capacity"
                className={inputClass}
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                required
              />
              <p className="text-xs text-muted">
                Held and confirmed applications count against this.
              </p>
            </div>
            <button type="submit" className={buttonClass('primary', 'w-full')} disabled={pending}>
              {pending ? <Spinner /> : <Plus size={20} />} Publish class
            </button>
          </form>
        </section>

        <aside className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Operations overview
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-ink">Live capacity</h3>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${
                liveStatus === 'connected'
                  ? 'bg-forest-soft text-forest-dark'
                  : liveStatus === 'syncing'
                    ? 'bg-amber-soft text-amber'
                    : 'bg-clay-soft text-clay'
              }`}
            >
              <span className="size-2 rounded-full bg-current" />
              {liveStatus === 'connected'
                ? 'Connected'
                : liveStatus === 'syncing'
                  ? 'Syncing'
                  : 'Disconnected'}
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
            Seat counts update automatically and remain safe when applications arrive at the same
            time.
          </p>
          <dl className="mt-4 grid grid-cols-4 gap-3 border-t border-line pt-4">
            <div>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">
                {classes.length}
              </dd>
              <dt className="mt-1 text-xs text-muted">Classes</dt>
            </div>
            <div>
              <dd className="font-display text-xl font-bold tabular-nums text-forest">
                {totals.open}
              </dd>
              <dt className="mt-1 text-xs text-muted">Open</dt>
            </div>
            <div>
              <dd className="font-display text-xl font-bold tabular-nums text-amber">
                {totals.held}
              </dd>
              <dt className="mt-1 text-xs text-muted">On hold</dt>
            </div>
            <div>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">
                {totals.confirmed}
              </dd>
              <dt className="mt-1 text-xs text-muted">Confirmed</dt>
            </div>
          </dl>
          <SeatField
            className="mt-4"
            confirmed={totals.confirmed}
            held={totals.held}
            total={totals.total}
            cells={60}
            cols={20}
          />
          <div className="mt-3">
            <SeatLegend />
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading
          title="Class overview"
          description="Select a column to sort the live capacity data."
          aside={`${sortedClasses.length} ${sortedClasses.length === 1 ? 'class' : 'classes'}`}
        />
        {classes.length === 0 ? (
          <p className="py-4 text-base text-muted">No classes published yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {sortedClasses.map((c) => (
                <li key={c.id} className="grid gap-3 py-5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-words text-lg font-semibold">{c.name}</p>
                    <span
                      className={`shrink-0 text-lg font-bold ${
                        c.availableSeats === 0 ? 'text-clay' : 'text-forest'
                      }`}
                    >
                      {c.availableSeats} open
                    </span>
                  </div>
                  <Fill c={c} />
                  <p className="text-sm text-muted">
                    {c.totalSeats} total, {c.heldSeats} held, {c.confirmedSeats} confirmed
                  </p>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-base">
                <thead>
                  <tr className="border-b-2 border-line text-sm text-muted">
                    <th className="py-3 pr-4 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg py-1 text-left hover:text-ink focus-visible:ring-2 focus-visible:ring-forest"
                        onClick={() => changeSort('name')}
                        aria-label="Sort by class and shift"
                      >
                        Class and shift <ArrowUpDown size={15} />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">Seats</th>
                    {(
                      [
                        ['totalSeats', 'Total'],
                        ['heldSeats', 'Held'],
                        ['confirmedSeats', 'Confirmed'],
                        ['availableSeats', 'Available'],
                      ] as const
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        className={`px-4 py-3 text-right font-semibold ${
                          key === 'availableSeats' ? 'pl-4' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg py-1 text-right hover:text-ink focus-visible:ring-2 focus-visible:ring-forest"
                          onClick={() => changeSort(key)}
                          aria-label={`Sort by ${label.toLowerCase()} seats`}
                        >
                          {label} <ArrowUpDown size={15} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedClasses.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold">{c.name}</p>
                        <p className="font-mono text-xs text-muted">{c.id}</p>
                      </td>
                      <td className="w-56 px-4 py-3">
                        <Fill c={c} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.totalSeats}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.heldSeats}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.confirmedSeats}</td>
                      <td
                        className={`py-3 pl-4 text-right text-base font-bold tabular-nums ${
                          c.availableSeats === 0 ? 'text-clay' : 'text-forest'
                        }`}
                      >
                        {c.availableSeats}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
