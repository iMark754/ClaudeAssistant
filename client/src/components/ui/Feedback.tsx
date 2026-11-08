import clsx from 'clsx';
import { AlertTriangle, Info, Loader2, RotateCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <>
      <Loader2 className={clsx('animate-spin', className ?? 'size-5')} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200/80', className)} aria-hidden="true" />;
}

/** Accessible loading region with skeleton children. */
export function LoadingBlock({ label = 'Caricamento in corso…', children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Impossibile caricare i dati',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={clsx('flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center', className)}>
      <AlertTriangle className="mb-3 size-8 text-red-600" aria-hidden="true" />
      <h2 className="text-base font-semibold text-red-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-800 hover:bg-red-100"
        >
          <RotateCw className="size-4" aria-hidden="true" />
          Riprova
        </button>
      )}
    </div>
  );
}

type CalloutTone = 'info' | 'warning' | 'danger' | 'success';

const calloutStyles: Record<CalloutTone, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export function Callout({
  tone = 'info',
  icon: Icon = tone === 'info' ? Info : AlertTriangle,
  title,
  children,
  action,
  className,
}: {
  tone?: CalloutTone;
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center', calloutStyles[tone], className)}>
      <div className="flex flex-1 gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
