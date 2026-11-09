import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { useMemo } from 'react';
import { allocateCells } from '../lib/admission';
import type { ApplicationStatus } from '../types/admission';

type Variant = 'primary' | 'secondary' | 'quiet' | 'dark' | 'light';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const sizes: Record<Size, string> = {
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-base',
};

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-white shadow-sm hover:bg-forest-dark',
  dark: 'bg-ink text-white hover:bg-black',
  light: 'bg-white text-night hover:bg-forest-soft focus-visible:ring-white',
  secondary: 'bg-forest-soft text-forest-dark hover:bg-[#d3e9dd]',
  quiet: 'border border-line bg-white text-ink hover:bg-paper',
};

export function buttonClass(variant: Variant = 'primary', extra = '', size: Size = 'md') {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`.trim();
}

const statusConfig: Record<ApplicationStatus, { label: string; className: string }> = {
  HELD: { label: 'Seat on hold', className: 'bg-amber-soft text-amber' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-forest-soft text-forest-dark' },
  EXPIRED: { label: 'Expired', className: 'bg-paper text-muted ring-1 ring-line' },
  CANCELLED: { label: 'Cancelled', className: 'bg-clay-soft text-clay' },
};

export function StatusPill({ status }: { status: ApplicationStatus }) {
  const item = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.className}`}
    >
      <span className="size-2 rounded-full bg-current" />
      {item.label}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {description ? <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p> : null}
      </div>
      {aside ? (
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted ring-1 ring-line">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-white/70 px-6 py-10 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-xl bg-forest-soft text-forest">
        <CircleHelp size={24} />
      </span>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className="mb-5 mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-5 md:grid-cols-2">
      <span className="sr-only">{label}</span>
      {[0, 1].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-xl bg-white ring-1 ring-line" />
      ))}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
}

// ---------- Seat grid ----------

interface Props {
  confirmed: number;
  held: number;
  total: number;
  cells?: number;
  cols?: number;
  tone?: 'light' | 'dark';
  className?: string;
}

const palette = {
  light: { confirmed: 'bg-forest', held: 'bg-amber-bright', open: 'bg-line' },
  dark: { confirmed: 'bg-forest-mint', held: 'bg-amber-bright', open: 'bg-white/10' },
};

/** Each cell is a seat. Filled left to right: confirmed, then on hold, then open. */
export function SeatField({
  confirmed,
  held,
  total,
  cells = 60,
  cols = 20,
  tone = 'light',
  className = '',
}: Props) {
  const colors = palette[tone];
  const items = useMemo(() => {
    const a = allocateCells(confirmed, held, total, cells);
    return [
      ...Array<{ color: string; label: string }>(a.confirmed).fill({
        color: colors.confirmed,
        label: 'Confirmed seat',
      }),
      ...Array<{ color: string; label: string }>(a.held).fill({
        color: colors.held,
        label: 'Seat on hold',
      }),
      ...Array<{ color: string; label: string }>(a.open).fill({
        color: colors.open,
        label: 'Open seat',
      }),
    ];
  }, [confirmed, held, total, cells, colors]);

  const open = Math.max(0, total - confirmed - held);

  return (
    <div
      role="img"
      aria-label={`${confirmed} confirmed, ${held} on hold, ${open} open, of ${total} seats`}
      className={`grid gap-[3px] sm:gap-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map(({ color, label }, i) => (
        <span
          key={i}
          aria-label={label}
          role="img"
          title={label}
          className={`aspect-square rounded-b-[2px] rounded-t-[5px] transition-colors duration-500 ${color}`}
        />
      ))}
    </div>
  );
}

export function SeatLegend({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const colors = palette[tone];
  const text = tone === 'dark' ? 'text-white/75' : 'text-muted';
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-1 text-sm ${text}`}>
      {[
        ['Confirmed', colors.confirmed],
        ['On hold', colors.held],
        ['Open', colors.open],
      ].map(([label, color]) => (
        <li key={label} className="flex items-center gap-2">
          <span className={`size-3 rounded-b-[2px] rounded-t-[4px] ${color}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
