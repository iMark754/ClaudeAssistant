import { CheckCheck, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { TASK_STATUSES, TASK_STATUS_LABELS, addDays, type TaskStatus, type TaskWithProject } from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useMyTasks, useUpdateTask } from '../../api/queries';
import { TaskRow } from '../../components/TaskRow';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../components/ui/Feedback';
import { PageHeader, SectionCard } from '../../components/ui/PageHeader';
import { CurrentMemberSelect } from '../../layout/CurrentMemberSelect';
import { useCurrentMember } from '../../lib/currentMember';
import { useDocumentTitle, useToday } from '../../lib/hooks';

interface Group {
  id: string;
  title: string;
  tasks: TaskWithProject[];
}

function groupTasks(tasks: TaskWithProject[], today: string): Group[] {
  const weekEnd = addDays(today, 7);
  const groups: Group[] = [
    { id: 'ritardo', title: 'In ritardo', tasks: [] },
    { id: 'oggi', title: 'Oggi', tasks: [] },
    { id: 'settimana', title: 'Prossimi 7 giorni', tasks: [] },
    { id: 'dopo', title: 'Più avanti', tasks: [] },
    { id: 'senza', title: 'Senza scadenza', tasks: [] },
  ];
  for (const task of tasks) {
    const due = task.dueDate;
    const index = due === null ? 4 : due < today ? 0 : due === today ? 1 : due <= weekEnd ? 2 : 3;
    groups[index]!.tasks.push(task);
  }
  return groups.filter((g) => g.tasks.length > 0);
}

function StatusSelect({ task }: { task: TaskWithProject }) {
  const update = useUpdateTask();
  const change = (status: TaskStatus) => {
    const previous = task.status;
    update.mutate(
      { id: task.id, version: task.version, status },
      {
        onSuccess: (saved) => {
          if (status === 'fatto') {
            toast.success(`«${task.title}» segnata come fatta`, {
              action: {
                label: 'Annulla',
                onClick: () =>
                  update.mutate(
                    { id: saved.id, version: saved.version, status: previous },
                    { onError: (error) => toast.error(errorMessage(error)) },
                  ),
              },
            });
          }
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };
  return (
    <select
      aria-label={`Stato di «${task.title}»`}
      value={task.status}
      disabled={update.isPending}
      onChange={(e) => change(e.target.value as TaskStatus)}
      className="h-8 rounded-lg border border-slate-300 bg-white pr-7 pl-2 text-xs font-medium text-slate-700"
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function MyTasksPage() {
  useDocumentTitle('Le mie attività');
  const today = useToday();
  const { currentMember } = useCurrentMember();
  const { data, isLoading, isError, error, refetch } = useMyTasks(currentMember?.id ?? null);
  const groups = useMemo(() => groupTasks(data ?? [], today), [data, today]);
  const overdue = groups.find((g) => g.id === 'ritardo')?.tasks.length ?? 0;

  if (!currentMember) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Le mie attività" />
        <EmptyState
          icon={UserRound}
          title="Chi sei?"
          description="Scegli il tuo nome per vedere le attività aperte assegnate a te in tutti i progetti."
          action={<CurrentMemberSelect className="justify-center" />}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Le mie attività"
        description={
          data
            ? data.length === 0
              ? `Nessuna attività aperta per ${currentMember.name}`
              : `${data.length} ${data.length === 1 ? 'attività aperta' : 'attività aperte'}${overdue > 0 ? `, di cui ${overdue} in ritardo` : ''} · ordinate per scadenza`
            : `Attività aperte di ${currentMember.name}`
        }
      />

      {isLoading && (
        <LoadingBlock label="Caricamento delle tue attività…">
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </LoadingBlock>
      )}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState icon={CheckCheck} title="Tutto fatto!" description="Non hai attività aperte nei progetti attivi o in pausa." />
      )}

      {groups.length > 0 && (
        <div className="space-y-5">
          {groups.map((group) => (
            <SectionCard
              key={group.id}
              id={`gruppo-${group.id}`}
              title={
                <span className={group.id === 'ritardo' ? 'text-red-800' : undefined}>
                  {group.title}{' '}
                  <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{group.tasks.length}</span>
                </span>
              }
            >
              <ul className="@container divide-y divide-slate-100">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} showAssignee={false} extra={<StatusSelect task={task} />} />
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
