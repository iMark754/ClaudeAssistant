import clsx from 'clsx';

export function ProgressBar({
  value,
  label,
  className,
  tone = 'brand',
}: {
  /** 0-100 */
  value: number;
  label: string;
  className?: string;
  tone?: 'brand' | 'success';
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={`${clamped}%`}
      className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500', tone === 'success' || clamped === 100 ? 'bg-emerald-500' : 'bg-brand-600')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
