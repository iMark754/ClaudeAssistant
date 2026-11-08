import clsx from 'clsx';
import { AlertCircle, FolderKanban, Plus, Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, isProjectStatus, type Project, type ProjectStatus } from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useProjects } from '../../api/queries';
import { Avatar } from '../../components/ui/Avatar';
import { ProjectStatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { DueDateChip } from '../../components/ui/DueDate';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../components/ui/Feedback';
import { Select, TextInput } from '../../components/ui/Form';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useDebouncedValue, useDocumentTitle } from '../../lib/hooks';
import { ProjectFormDialog } from './ProjectFormDialog';

const DEFAULT_STATUSES: ProjectStatus[] = ['attivo', 'in_pausa', 'completato'];

const SORT_OPTIONS = [
  { value: 'due-asc', label: 'Scadenza più vicina' },
  { value: 'due-desc', label: 'Scadenza più lontana' },
  { value: 'progress-desc', label: 'Avanzamento: più alto' },
  { value: 'progress-asc', label: 'Avanzamento: più basso' },
  { value: 'name-asc', label: 'Nome (A–Z)' },
  { value: 'created-desc', label: 'Creati di recente' },
] as const;

function ProjectCard({ project }: { project: Project }) {
  const live = project.status === 'attivo' || project.status === 'in_pausa';
  return (
    <li>
      <Link
        to={`/progetti/${project.id}/kanban`}
        className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 group-hover:text-brand-700">{project.name}</h2>
          <ProjectStatusBadge status={project.status} className="shrink-0" />
        </div>
        {project.description && <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{project.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <Avatar name={project.ownerName} size="xs" decorative />
            <span>
              <span className="sr-only">Responsabile: </span>
              {project.ownerName}
            </span>
          </span>
          {project.dueDate ? (
            <DueDateChip dueDate={project.dueDate} done={!live} />
          ) : (
            <span className="text-xs text-slate-500">Senza scadenza</span>
          )}
        </div>

        <div className="mt-auto pt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
            <span>
              {project.taskCount === 0 ? 'Nessuna attività' : `${project.doneCount} di ${project.taskCount} attività fatte`}
            </span>
            <span className="font-semibold tabular-nums text-slate-800">{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} label={`Avanzamento di ${project.name}`} />
          {project.overdueCount > 0 && live && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700">
              <AlertCircle className="size-3.5" aria-hidden="true" />
              {project.overdueCount === 1 ? '1 attività in ritardo' : `${project.overdueCount} attività in ritardo`}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

export function ProjectsPage() {
  useDocumentTitle('Progetti');
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const statusParam = params.get('stato');
  const statuses: ProjectStatus[] =
    statusParam === null ? DEFAULT_STATUSES : statusParam.split(',').filter(isProjectStatus);
  const sortValue = SORT_OPTIONS.some((o) => o.value === params.get('ordina')) ? params.get('ordina')! : 'due-asc';
  const [sort, dir] = sortValue.split('-') as [string, string];

  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const update = (changes: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedSearch) update({ q: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const query = useProjects({ q: debouncedSearch, status: statuses.join(','), sort, dir });
  const data = query.data;

  const toggleStatus = (status: ProjectStatus) => {
    const next = statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status];
    const ordered = PROJECT_STATUSES.filter((s) => next.includes(s));
    const isDefault = ordered.length === DEFAULT_STATUSES.length && ordered.every((s) => DEFAULT_STATUSES.includes(s));
    update({ stato: isDefault ? null : ordered.join(',') });
  };

  const resetFilters = () => {
    setSearch('');
    setParams({}, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Progetti"
        description={data ? `${data.total} ${data.total === 1 ? 'progetto' : 'progetti'} in totale` : 'Tutti i progetti del team'}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
            Nuovo progetto
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <TextInput
            type="search"
            aria-label="Cerca progetti"
            placeholder="Cerca per nome o descrizione…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per stato">
          {PROJECT_STATUSES.map((status) => {
            const active = statuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={clsx(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
                  active ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {PROJECT_STATUS_LABELS[status]}
                {data && <span className="text-xs tabular-nums opacity-70">{data.statusCounts[status]}</span>}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="whitespace-nowrap">Ordina per</span>
          <Select value={sortValue} onChange={(e) => update({ ordina: e.target.value === 'due-asc' ? null : e.target.value })} className="h-9 w-auto">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {query.isLoading && (
        <LoadingBlock label="Caricamento dei progetti…">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-52 rounded-2xl" />
              </li>
            ))}
          </ul>
        </LoadingBlock>
      )}

      {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />}

      {data && data.total === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="Nessun progetto"
          description="Crea il primo progetto per iniziare a organizzare le attività del team."
          action={
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
              Crea un progetto
            </Button>
          }
        />
      )}

      {data && data.total > 0 && data.items.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="Nessun progetto corrisponde ai filtri"
          description="Prova a cambiare la ricerca o a includere altri stati."
          action={<Button onClick={resetFilters}>Azzera filtri</Button>}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="sr-only" aria-live="polite">
            {data.items.length} progetti visualizzati
          </p>
          <ul className={clsx('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', query.isPlaceholderData && 'opacity-60 transition-opacity')}>
            {data.items.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ul>
        </>
      )}

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} project={null} />
    </div>
  );
}
