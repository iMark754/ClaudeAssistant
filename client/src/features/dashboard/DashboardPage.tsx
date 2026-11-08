import clsx from 'clsx';
import { AlarmClock, CalendarClock, CheckCircle2, FolderKanban, ListTodo, PartyPopper, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  OPEN_TASK_STATUSES,
  TASK_STATUS_LABELS,
  addDays,
  formatDate,
  formatHours,
  type DashboardData,
  type TaskWithProject,
  type WorkloadRow,
} from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useDashboard } from '../../api/queries';
import { TaskRow } from '../../components/TaskRow';
import { Avatar } from '../../components/ui/Avatar';
import { TASK_STATUS_STYLES } from '../../components/ui/Badges';
import { DueDateChip } from '../../components/ui/DueDate';
import { ErrorState, LoadingBlock, Skeleton } from '../../components/ui/Feedback';
import { PageHeader, SectionCard } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useCurrentMember } from '../../lib/currentMember';
import { useDocumentTitle } from '../../lib/hooks';

const INITIAL_ROWS = 6;

function Kpi({ label, value, icon: Icon, tone, href }: { label: string; value: number; icon: LucideIcon; tone: string; href: string }) {
  const content = (
    <>
      <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-2xl font-semibold tabular-nums text-slate-900">{value}</span>
        <span className="block text-sm text-slate-600">{label}</span>
      </span>
    </>
  );
  const className = 'flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs';
  return href.startsWith('#') ? (
    <a href={href} className={clsx(className, 'hover:border-brand-300')}>
      {content}
    </a>
  ) : (
    <Link to={href} className={clsx(className, 'hover:border-brand-300')}>
      {content}
    </Link>
  );
}

function TaskList({
  id,
  title,
  description,
  data,
  emptyIcon: EmptyIcon,
  emptyText,
}: {
  id: string;
  title: string;
  description: string;
  data: { total: number; items: TaskWithProject[] };
  emptyIcon: LucideIcon;
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data.items : data.items.slice(0, INITIAL_ROWS);
  return (
    <SectionCard
      id={id}
      title={
        <>
          {title} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{data.total}</span>
        </>
      }
      description={description}
    >
      {data.total === 0 ? (
        <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-500">
          <EmptyIcon className="size-5 text-emerald-500" aria-hidden="true" />
          {emptyText}
        </div>
      ) : (
        <>
          <ul className="@container divide-y divide-slate-100">
            {visible.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
          {data.items.length > INITIAL_ROWS && (
            <div className="border-t border-slate-100 px-5 py-2.5">
              <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? 'Mostra meno' : `Mostra tutte (${data.items.length})`}
              </button>
              {expanded && data.total > data.items.length && (
                <p className="mt-1 text-xs text-slate-500">Sono visualizzate le prime {data.items.length} di {data.total}.</p>
              )}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

function ActiveProjects({ projects }: { projects: DashboardData['activeProjects'] }) {
  return (
    <SectionCard
      id="progetti-attivi"
      title="Progetti attivi"
      description="Avanzamento calcolato sulle attività fatte"
      actions={
        <Link to="/progetti?stato=attivo" className="text-sm font-medium whitespace-nowrap text-brand-700 hover:underline">
          Vedi tutti
        </Link>
      }
    >
      {projects.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">Nessun progetto attivo al momento.</p>
      ) : (
        <ul className="@container divide-y divide-slate-100">
          {projects.map((p) => (
            <li key={p.id} className="px-5 py-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Link to={`/progetti/${p.id}/kanban`} className="min-w-0 truncate text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {p.name}
                </Link>
                <div className="flex items-center gap-2">
                  {p.overdueCount > 0 && <span className="text-xs font-medium text-red-700">{p.overdueCount} in ritardo</span>}
                  {p.dueDate ? <DueDateChip dueDate={p.dueDate} /> : <span className="text-xs text-slate-500">Senza scadenza</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ProgressBar value={p.progress} label={`Avanzamento di ${p.name}`} />
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600">
                  {p.progress}% · {p.doneCount}/{p.taskCount}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function Workload({ rows }: { rows: WorkloadRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.openCount));
  return (
    <SectionCard id="carico" title="Carico di lavoro" description="Attività aperte per membro (progetti non archiviati)">
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-3 text-xs text-slate-600" aria-hidden="true">
        {OPEN_TASK_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={clsx('size-2.5 rounded-sm', TASK_STATUS_STYLES[s].bar)} />
            {TASK_STATUS_LABELS[s]}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">Aggiungi dei membri per vedere il carico di lavoro.</p>
      ) : (
        <ul className="space-y-3.5 px-5 py-4">
          {rows.map((row) => {
            const breakdown = OPEN_TASK_STATUSES.filter((s) => row.byStatus[s] > 0)
              .map((s) => `${row.byStatus[s]} ${TASK_STATUS_LABELS[s].toLowerCase()}`)
              .join(', ');
            return (
              <li key={row.memberId ?? 'none'}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <Avatar name={row.memberId === null ? null : row.name} size="xs" decorative />
                  <span className={clsx('min-w-0 truncate text-sm font-medium', row.memberId === null ? 'text-slate-500 italic' : 'text-slate-900')}>
                    {row.name}
                  </span>
                  {row.role && <span className="hidden truncate text-xs text-slate-500 sm:inline">{row.role}</span>}
                  <span className="ml-auto shrink-0 text-xs text-slate-600">
                    <strong className="tabular-nums text-slate-900">{row.openCount}</strong> aperte
                    {row.estimateHours > 0 && <> · {formatHours(row.estimateHours)}</>}
                    {row.overdueCount > 0 && <span className="text-red-700"> · {row.overdueCount} in ritardo</span>}
                  </span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  {OPEN_TASK_STATUSES.map((s) =>
                    row.byStatus[s] > 0 ? (
                      <div key={s} className={TASK_STATUS_STYLES[s].bar} style={{ width: `${(row.byStatus[s] / max) * 100}%` }} />
                    ) : null,
                  )}
                </div>
                <span className="sr-only">{row.openCount === 0 ? 'Nessuna attività aperta' : `Dettaglio: ${breakdown}`}</span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { currentMember } = useCurrentMember();
  const { data, isLoading, isError, error, refetch } = useDashboard();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={currentMember ? `Ciao, ${currentMember.name.split(' ')[0]}` : 'Dashboard'}
        description={data ? <span className="first-letter:uppercase">{formatDate(data.today, 'long')}</span> : 'Panoramica del lavoro del team'}
      />

      {isLoading && (
        <LoadingBlock label="Caricamento della dashboard…">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </LoadingBlock>
      )}

      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Progetti attivi" value={data.kpis.activeProjects} icon={FolderKanban} tone="bg-brand-50 text-brand-700" href="/progetti?stato=attivo" />
            <Kpi label="Attività aperte" value={data.kpis.openTasks} icon={ListTodo} tone="bg-slate-100 text-slate-700" href="#carico" />
            <Kpi label="In ritardo" value={data.kpis.overdueTasks} icon={AlarmClock} tone="bg-red-50 text-red-700" href="#in-ritardo" />
            <Kpi label="In scadenza in 7 giorni" value={data.kpis.dueSoonTasks} icon={CalendarClock} tone="bg-amber-50 text-amber-800" href="#in-scadenza" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TaskList
              id="in-ritardo"
              title="Attività in ritardo"
              description="Aperte con scadenza superata, dalla più vecchia"
              data={data.overdue}
              emptyIcon={PartyPopper}
              emptyText="Nessuna attività in ritardo. Ottimo lavoro!"
            />
            <TaskList
              id="in-scadenza"
              title="In scadenza nei prossimi 7 giorni"
              description={`Aperte con scadenza dal ${formatDate(data.today, 'short')} al ${formatDate(addDays(data.today, 7), 'short')}`}
              data={data.dueSoon}
              emptyIcon={CheckCircle2}
              emptyText="Nessuna scadenza nei prossimi 7 giorni."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ActiveProjects projects={data.activeProjects} />
            <Workload rows={data.workload} />
          </div>
        </div>
      )}
    </div>
  );
}
