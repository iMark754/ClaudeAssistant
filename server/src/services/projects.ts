import {
  PROJECT_STATUSES,
  PROJECT_SORTS,
  TASK_STATUS_LABELS,
  isProjectStatus,
  normalizeForSearch,
  plural,
  projectCreateSchema,
  projectUpdateSchema,
  type OpenTasksDetails,
  type Project,
  type ProjectListResponse,
  type ProjectSort,
  type ProjectStatus,
} from '@gp/shared';
import { nowIso, today } from '../clock';
import { AppError, fieldError, notFound, staleError } from '../errors';
import { memberExists } from '../repositories/members';
import * as projects from '../repositories/projects';
import { assertProjectWritable, type ServiceContext } from './context';

const projectNotFound = () => notFound('Progetto non trovato');
const DUE_BEFORE_START = 'La scadenza non può precedere la data di inizio';

export function requireProjectRow(ctx: ServiceContext, id: number): projects.ProjectRow {
  const row = projects.findProjectRow(ctx.db, id);
  if (!row) throw projectNotFound();
  return row;
}

export function getProject(ctx: ServiceContext, id: number): Project {
  const project = projects.getProject(ctx.db, id, today(ctx.clock));
  if (!project) throw projectNotFound();
  return project;
}

export interface ProjectListQuery {
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
}

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

function compareProjects(sort: ProjectSort, dir: 1 | -1) {
  return (a: Project, b: Project): number => {
    let result = 0;
    switch (sort) {
      case 'due':
        // Projects without a due date always go last.
        if (a.dueDate === b.dueDate) result = 0;
        else if (a.dueDate === null) return 1;
        else if (b.dueDate === null) return -1;
        else result = (a.dueDate < b.dueDate ? -1 : 1) * dir;
        break;
      case 'progress':
        result = (a.progress - b.progress) * dir;
        break;
      case 'name':
        result = collator.compare(a.name, b.name) * dir;
        break;
      case 'created':
        result = (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) * dir;
        break;
    }
    return result || collator.compare(a.name, b.name) || a.id - b.id;
  };
}

/** Search (accent-insensitive, name + description), status filter and sorting. */
export function listProjects(ctx: ServiceContext, query: ProjectListQuery = {}): ProjectListResponse {
  const all = projects.listProjects(ctx.db, today(ctx.clock));
  const q = normalizeForSearch(query.q ?? '');
  const matching = q
    ? all.filter((p) => normalizeForSearch(`${p.name} ${p.description}`).includes(q))
    : all;

  const statusCounts = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as Record<ProjectStatus, number>;
  for (const p of matching) statusCounts[p.status]++;

  const statuses = (query.status ?? '').split(',').filter(isProjectStatus);
  const filtered = statuses.length > 0 ? matching.filter((p) => statuses.includes(p.status)) : matching;

  const sort: ProjectSort = (PROJECT_SORTS as readonly string[]).includes(query.sort ?? '') ? (query.sort as ProjectSort) : 'due';
  const dir = query.dir === 'desc' ? -1 : 1;
  filtered.sort(compareProjects(sort, dir));

  return { items: filtered, statusCounts, total: all.length };
}

export function createProject(ctx: ServiceContext, input: unknown): Project {
  const data = projectCreateSchema.parse(input);
  return ctx.db.transaction(() => {
    if (!memberExists(ctx.db, data.ownerId)) {
      throw fieldError('ownerId', 'Il responsabile selezionato non esiste', 'INVALID_REFERENCE');
    }
    const id = projects.insertProject(
      ctx.db,
      {
        name: data.name,
        description: data.description ?? '',
        status: data.status ?? 'attivo',
        startDate: data.startDate,
        dueDate: data.dueDate ?? null,
        ownerId: data.ownerId,
      },
      nowIso(ctx.clock),
    );
    return getProject(ctx, id);
  });
}

function openTasksMessage(details: OpenTasksDetails): string {
  const parts = (['da_fare', 'in_corso', 'in_revisione'] as const)
    .filter((s) => details.byStatus[s] > 0)
    .map((s) => `${details.byStatus[s]} ${TASK_STATUS_LABELS[s].toLowerCase()}`);
  const subject =
    details.openCount === 1 ? "c'è ancora 1 attività non fatta" : `ci sono ancora ${details.openCount} attività non fatte`;
  return `Il progetto non può essere completato perché ${subject} (${parts.join(', ')}). Completale o eliminale, poi riprova.`;
}

export function updateProject(ctx: ServiceContext, id: number, input: unknown): Project {
  const data = projectUpdateSchema.parse(input);
  return ctx.db.transaction(() => {
    const row = requireProjectRow(ctx, id);
    if (row.version !== data.version) throw staleError('progetto');
    const { version, ...changes } = data;

    const current = {
      name: row.name,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      dueDate: row.due_date,
      ownerId: row.owner_id,
    };

    if (row.status === 'archiviato') {
      // Read-only: the only allowed change is restoring it to a non-archived status.
      const restoring = changes.status !== undefined && changes.status !== 'archiviato';
      const otherChanges = (Object.keys(changes) as (keyof typeof changes)[]).filter(
        (key) => key !== 'status' && changes[key] !== undefined && changes[key] !== current[key],
      );
      if (!restoring || otherChanges.length > 0) {
        assertProjectWritable(row, 'Il progetto è archiviato ed è in sola lettura: ripristinalo prima di modificarlo.');
      }
    }

    const merged = { ...current, ...stripUndefined(changes) };

    if (merged.dueDate && merged.dueDate < merged.startDate) throw fieldError('dueDate', DUE_BEFORE_START);

    if (merged.ownerId !== current.ownerId && !memberExists(ctx.db, merged.ownerId)) {
      throw fieldError('ownerId', 'Il responsabile selezionato non esiste', 'INVALID_REFERENCE');
    }

    if (merged.dueDate && merged.dueDate !== current.dueDate) {
      const conflicts = projects.tasksDueAfter(ctx.db, id, merged.dueDate);
      if (conflicts.count > 0) {
        const message = `La nuova scadenza è precedente a quella di ${plural(conflicts.count, 'attività', 'attività')} del progetto. Anticipa prima le loro scadenze.`;
        throw new AppError(422, 'PROJECT_DUE_BEFORE_TASKS', message, conflicts, 'dueDate', { dueDate: message });
      }
    }

    if (merged.status === 'completato' && current.status !== 'completato') {
      const details = projects.openTasksDetails(ctx.db, id);
      if (details.openCount > 0) {
        throw new AppError(409, 'PROJECT_HAS_OPEN_TASKS', openTasksMessage(details), details, 'status');
      }
    }

    if (!projects.updateProject(ctx.db, id, version, merged, nowIso(ctx.clock))) throw staleError('progetto');
    return getProject(ctx, id);
  });
}

export function deleteProject(ctx: ServiceContext, id: number): void {
  ctx.db.transaction(() => {
    const row = requireProjectRow(ctx, id);
    assertProjectWritable(row, 'Il progetto è archiviato ed è in sola lettura: ripristinalo prima di eliminarlo.');
    projects.deleteProject(ctx.db, id);
  });
}

function stripUndefined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}
