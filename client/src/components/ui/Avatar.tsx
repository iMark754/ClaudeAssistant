import clsx from 'clsx';
import { UserRound } from 'lucide-react';
import { initials } from '@gp/shared';

const PALETTE = [
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-900',
  'bg-lime-100 text-lime-900',
  'bg-emerald-100 text-emerald-800',
  'bg-cyan-100 text-cyan-900',
  'bg-sky-100 text-sky-800',
  'bg-indigo-100 text-indigo-800',
  'bg-fuchsia-100 text-fuchsia-800',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
};

/** Initials avatar. With `name === null` it renders the "unassigned" placeholder. */
export function Avatar({
  name,
  size = 'sm',
  className,
  decorative = false,
}: {
  name: string | null;
  size?: keyof typeof sizes;
  className?: string;
  /** When true the avatar is hidden from assistive tech (the name is shown next to it). */
  decorative?: boolean;
}) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': name ?? 'Non assegnata' };
  if (name === null) {
    return (
      <span
        {...a11y}
        title="Non assegnata"
        className={clsx('inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400', sizes[size], className)}
      >
        <UserRound className="size-3.5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      {...a11y}
      title={name}
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', colorFor(name), sizes[size], className)}
    >
      {initials(name)}
    </span>
  );
}
