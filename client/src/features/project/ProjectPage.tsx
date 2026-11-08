import clsx from 'clsx';
import { Archive, CheckCircle2, ChevronRight, Download, FolderX, KanbanSquare, List, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  filterTasks,
  formatDate,
  parseTaskFilters,
  taskFiltersToParams,
  type MemberWithStats,
  type Project,
  type TaskFilters,
  type TaskStatus,
  type TaskSummary,
} from '@gp/shared';
import { errorMessage, isApiError } from '../../api/client';
import { useDeleteProject, useMembers, useProject, useProjectTasks } from '../../api/queries';
import { Avatar } from '../../components/ui/Avatar';
import { Button, buttonClass } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { DueDateChip } from '../../components/ui/DueDate';
import { Callout, EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../components/ui/Feedback';
import { ActionMenu } from '../../components/ui/Menu';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useDocumentTitle, useToday } from '../../lib/hooks';
import { KanbanBoard } from '../board/KanbanBoard';
import { ProjectFormDialog } from '../projects/ProjectFormDialog';
import { ProjectStatusMenu, useProjectStatusChange } from '../projects/ProjectStatus';
import { TaskListView } from '../task-list/TaskListView';
import { TaskDetailDrawer } from '../task-detail/TaskDetailDrawer';
import { TaskFormDialog } from '../task-detail/TaskFormDialog';
import { TaskFilterBar } from './TaskFilterBar';

export interface ProjectOutletContext {
  project: Project;
  tasks: TaskSummary[];
  filtered: TaskSummary[];
  filtersActive: boolean;
  readOnly: boolean;
  openTask: (id: number) => void;
  openCreate: (status?: TaskStatus) => void;
  resetFilters: () => void;
}

const useProjectOutlet = () => useOutletContext<ProjectOutletContext>();

export function KanbanView() {
  const ctx = useProjectOutlet();
  return (
    <KanbanBoard
      project={ctx.project}
      tasks={ctx.filtered}
      readOnly={ctx.readOnly}
      onOpenTask={ctx.openTask}
      onCreate={ctx.openCreate}
      filtersActive={ctx.filtersActive}
    />
  );
}

export function ListView() {
  const ctx = useProjectOutlet();
  return (
    <TaskListView
      tasks={ctx.filtered}
      totalCount={ctx.tasks.length}
      onOpenTask={ctx.openTask}
      onCreate={ctx.readOnly || ctx.project.status === 'completato' ? undefined : () => ctx.openCreate()}
      onResetFilters={ctx.resetFilters}
    />
  );
}

function ProjectHeader({
  project,
  onEdit,
  onDelete,
  onCreate,
  exportUrl,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onCreate: () => void;
  exportUrl: string;
}) {
  const archived = project.status === 'archiviato';
  const completed = project.status === 'completato';
  const live = project.status === 'attivo' || project.status === 'in_pausa';

  return (
    <div className="mb-5">
      <nav aria-label="Percorso" className="mb-2 flex items-center gap-1 text-sm text-slate-500">
        <Link to="/progetti" className="hover:text-slate-800 hover:underline">
          Progetti
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="truncate text-slate-700" aria-current="page">
          {project.name}
        </span>
      </nav>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
            <ProjectStatusMenu project={project} />
          </div>
          {project.description && <p className="mt-1.5 max-w-3xl text-sm whitespace-pre-line text-slate-600">{project.description}</p>}
          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Responsabile</dt>
              <Avatar name={project.ownerName} size="xs" decorative />
              <dd>{project.ownerName}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>Inizio:</dt>
              <dd className="font-medium text-slate-800">{formatDate(project.startDate)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Scadenza:</dt>
              <dd className="flex items-center gap-1.5 font-medium text-slate-800">
                {project.dueDate ? (
                  <>
                    {formatDate(project.dueDate)}
                    {live && <DueDateChip dueDate={project.dueDate} onlyIfNear />}
                  </>
                ) : (
                  'nessuna'
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3 xl:w-[23rem]">
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button
              variant="primary"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={onCreate}
              disabled={archived || completed}
              title={archived ? 'Il progetto è archiviato' : completed ? 'Il progetto è completato' : undefined}
            >
              Nuova attività
            </Button>
            <Button icon={<Pencil className="size-4" aria-hidden="true" />} onClick={onEdit} disabled={archived}>
              Modifica
            </Button>
            <ActionMenu
              label="Altre azioni sul progetto"
              items={[
                {
                  label: 'Esporta attività in CSV',
                  icon: <Download className="size-4 text-slate-500" aria-hidden="true" />,
                  onSelect: () => window.location.assign(exportUrl),
                },
                {
                  label: 'Elimina progetto',
                  icon: <Trash2 className="size-4" aria-hidden="true" />,
                  onSelect: onDelete,
                  danger: true,
                  disabled: archived,
                  separatorBefore: true,
                },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-slate-600">
              <span>{project.taskCount === 0 ? 'Nessuna attività' : `${project.doneCount} di ${project.taskCount} attività fatte`}</span>
              <span className="font-semibold tabular-nums text-slate-800">{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} label="Avanzamento del progetto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectPage() {
  const { projectId: rawId } = useParams();
  const projectId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : 0;
  const location = useLocation();
  const navigate = useNavigate();
  const today = useToday();
  const [params, setParams] = useSearchParams();

  const projectQuery = useProject(projectId);
  const tasksQuery = useProjectTasks(projectId);
  const { data: members } = useMembers();
  const project = projectQuery.data;
  useDocumentTitle(project?.name ?? 'Progetto');

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const deleteProject = useDeleteProject();
  const restore = useProjectStatusChange(project);

  const view = location.pathname.endsWith('/lista') ? 'lista' : 'kanban';
  const filters = useMemo(() => parseTaskFilters(params), [params]);
  // Columns already split tasks by status: the status filter only applies to the list.
  const effectiveFilters: TaskFilters = useMemo(() => (view === 'kanban' ? { ...filters, statuses: [] } : filters), [filters, view]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const filtered = useMemo(() => filterTasks(tasks, effectiveFilters, today), [tasks, effectiveFilters, today]);
  const filtersActive = filtered.length !== tasks.length || Object.keys(taskFiltersToParams(effectiveFilters)).length > 0;

  const taskParam = params.get('attivita');
  const openTaskId = taskParam && /^\d+$/.test(taskParam) ? Number(taskParam) : null;

  const setFilters = (next: TaskFilters) => {
    setParams(
      (prev) => {
        const result = new URLSearchParams(taskFiltersToParams(next));
        for (const key of ['attivita', 'ordina', 'dir']) {
          const value = prev.get(key);
          if (value) result.set(key, value);
        }
        return result;
      },
      { replace: true },
    );
  };

  const setTaskParam = (id: number | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === null) next.delete('attivita');
        else next.set('attivita', String(id));
        return next;
      },
      { replace: true },
    );

  // Query string shared by the two tabs (filters, without the open task).
  const tabSearch = useMemo(() => {
    const next = new URLSearchParams(params);
    next.delete('attivita');
    const s = next.toString();
    return s ? `?${s}` : '';
  }, [params]);

  const exportUrl = useMemo(() => {
    const exportParams = new URLSearchParams(taskFiltersToParams(effectiveFilters));
    if (view === 'lista') {
      for (const key of ['ordina', 'dir']) {
        const value = params.get(key);
        if (value) exportParams.set(key, value);
      }
    }
    const s = exportParams.toString();
    return `/api/projects/${projectId}/tasks.csv${s ? `?${s}` : ''}`;
  }, [effectiveFilters, params, projectId, view]);

  if (projectQuery.isLoading) {
    return (
      <LoadingBlock label="Caricamento del progetto…">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-2 h-8 w-80" />
        <Skeleton className="mb-8 h-4 w-96 max-w-full" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      </LoadingBlock>
    );
  }

  if (projectQuery.isError || !project) {
    if (isApiError(projectQuery.error, 'NOT_FOUND') || !projectId) {
      return (
        <EmptyState
          icon={FolderX}
          title="Progetto non trovato"
          description="Il progetto potrebbe essere stato eliminato."
          action={
            <Link to="/progetti" className={buttonClass('primary')}>
              Torna ai progetti
            </Link>
          }
        />
      );
    }
    return <ErrorState message={errorMessage(projectQuery.error)} onRetry={() => projectQuery.refetch()} />;
  }

  const readOnly = project.status === 'archiviato';
  const outletContext: ProjectOutletContext = {
    project,
    tasks,
    filtered,
    filtersActive,
    readOnly,
    openTask: (id) => setTaskParam(id),
    openCreate: (status) => setCreateStatus(status ?? 'da_fare'),
    resetFilters: () => setFilters({ q: '', assignees: [], priorities: [], statuses: [], overdue: false }),
  };

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors',
      isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
    );

  return (
    <div className="mx-auto max-w-[110rem]">
      <ProjectHeader
        project={project}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onCreate={() => setCreateStatus('da_fare')}
        exportUrl={exportUrl}
      />

      {readOnly && (
        <Callout
          tone="warning"
          icon={Archive}
          title="Progetto archiviato: sola lettura"
          className="mb-5"
          action={
            <Button size="sm" onClick={() => restore.request('attivo')} loading={restore.pending}>
              Ripristina il progetto
            </Button>
          }
        >
          Puoi consultare ed esportare le attività, ma non modificarle. Ripristina il progetto per lavorarci di nuovo.
        </Callout>
      )}
      {project.status === 'completato' && (
        <Callout
          tone="success"
          icon={CheckCircle2}
          title="Progetto completato"
          className="mb-5"
          action={
            <Button size="sm" onClick={() => restore.request('attivo')} loading={restore.pending}>
              Riapri il progetto
            </Button>
          }
        >
          Tutte le attività sono fatte. Per aggiungerne di nuove o riaprirne una, riporta il progetto in stato «Attivo».
        </Callout>
      )}
      {restore.dialogs}

      <div className="mb-4 flex gap-6 border-b border-slate-200" role="navigation" aria-label="Viste del progetto">
        <NavLink to={`kanban${tabSearch}`} className={tabClass}>
          <KanbanSquare className="size-4" aria-hidden="true" />
          Kanban
        </NavLink>
        <NavLink to={`lista${tabSearch}`} className={tabClass}>
          <List className="size-4" aria-hidden="true" />
          Lista
        </NavLink>
      </div>

      <div className="mb-4">
        <TaskFilterBar
          filters={filters}
          onChange={setFilters}
          members={members ?? ([] as MemberWithStats[])}
          showStatus={view === 'lista'}
          shown={filtered.length}
          total={tasks.length}
        />
      </div>

      {tasksQuery.isLoading && (
        <LoadingBlock label="Caricamento delle attività…">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-xl" />
            ))}
          </div>
        </LoadingBlock>
      )}
      {tasksQuery.isError && <ErrorState message={errorMessage(tasksQuery.error)} onRetry={() => tasksQuery.refetch()} />}
      {tasksQuery.data && <Outlet context={outletContext} />}

      {openTaskId !== null && <TaskDetailDrawer taskId={openTaskId} onClose={() => setTaskParam(null)} />}
      {createStatus !== null && (
        <TaskFormDialog project={project} initialStatus={createStatus} onClose={() => setCreateStatus(null)} onCreated={(id) => setTaskParam(id)} />
      )}
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminare «${project.name}»?`}
        description={
          project.taskCount > 0
            ? `Verranno eliminate anche ${project.taskCount === 1 ? 'l’unica attività' : `le sue ${project.taskCount} attività`} e i relativi commenti. L’operazione non può essere annullata.`
            : 'L’operazione non può essere annullata.'
        }
        confirmLabel="Elimina progetto"
        loading={deleteProject.isPending}
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => {
              toast.success('Progetto eliminato');
              navigate('/progetti');
            },
            onError: (error) => {
              setDeleteOpen(false);
              toast.error(errorMessage(error));
            },
          })
        }
      />
    </div>
  );
}
