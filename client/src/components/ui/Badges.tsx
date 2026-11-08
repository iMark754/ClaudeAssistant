import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUp, Minus } from 'lucide-react';
import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@gp/shared';
import type { ReactNode } from 'react';

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>
      {children}
    </span>
  );
}

export const TASK_STATUS_STYLES: Record<TaskStatus, { badge: string; dot: string; bar: string }> = {
  da_fare: { badge: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400' },
  in_corso: { badge: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500' },
  in_revisione: { badge: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200', dot: 'bg-violet-500', bar: 'bg-violet-500' },
  fatto: { badge: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge className={clsx(TASK_STATUS_STYLES[status].badge, className)}>
      <span className={clsx('size-1.5 rounded-full', TASK_STATUS_STYLES[status].dot)} aria-hidden="true" />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  bassa: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  media: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200',
  alta: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200',
  urgente: 'bg-red-600 text-white',
};

const PRIORITY_ICONS: Record<TaskPriority, typeof ArrowDown> = {
  bassa: ArrowDown,
  media: Minus,
  alta: ArrowUp,
  urgente: ChevronsUp,
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const Icon = PRIORITY_ICONS[priority];
  return (
    <Badge className={clsx(PRIORITY_STYLES[priority], className)}>
      <Icon className="size-3" aria-hidden="true" />
      <span>
        <span className="sr-only">Priorità </span>
        {TASK_PRIORITY_LABELS[priority]}
      </span>
    </Badge>
  );
}

const PROJECT_STATUS_STYLES: Record<ProjectStatus, { badge: string; dot: string }> = {
  attivo: { badge: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200', dot: 'bg-emerald-500' },
  in_pausa: { badge: 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300', dot: 'bg-amber-500' },
  completato: { badge: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200', dot: 'bg-blue-500' },
  archiviato: { badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-300', dot: 'bg-slate-400' },
};

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge className={clsx(PROJECT_STATUS_STYLES[status].badge, className)}>
      <span className={clsx('size-1.5 rounded-full', PROJECT_STATUS_STYLES[status].dot)} aria-hidden="true" />
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
