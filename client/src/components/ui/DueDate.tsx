import clsx from 'clsx';
import { CalendarClock } from 'lucide-react';
import { describeDueDate, formatDate, type DueTone } from '@gp/shared';
import { useToday } from '../../lib/hooks';

const toneStyles: Record<DueTone, string> = {
  overdue: 'text-red-700 bg-red-50 ring-1 ring-inset ring-red-200',
  today: 'text-amber-900 bg-amber-100 ring-1 ring-inset ring-amber-300',
  soon: 'text-amber-800 bg-amber-50 ring-1 ring-inset ring-amber-200',
  normal: 'text-slate-600 bg-slate-50 ring-1 ring-inset ring-slate-200',
  done: 'text-slate-500 bg-slate-50 ring-1 ring-inset ring-slate-200',
};

/** Due date chip with a relative label ("Scade domani", "Scaduta da 3 giorni"). */
export function DueDateChip({
  dueDate,
  done = false,
  onlyIfNear = false,
  className,
}: {
  dueDate: string | null;
  done?: boolean;
  /** Render nothing when the date is more than a week away (the date is already shown elsewhere). */
  onlyIfNear?: boolean;
  className?: string;
}) {
  const today = useToday();
  if (!dueDate) return null;
  const { label, tone } = describeDueDate(dueDate, today, done);
  if (onlyIfNear && tone === 'normal') return null;
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', toneStyles[tone], className)}
      title={`Scadenza: ${formatDate(dueDate, 'long')}`}
    >
      <CalendarClock className="size-3" aria-hidden="true" />
      <span className="sr-only">Scadenza: </span>
      {label}
    </span>
  );
}
