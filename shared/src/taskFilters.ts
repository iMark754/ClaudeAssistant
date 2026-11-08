/**
 * Task filtering and sorting, shared by the client views (in-memory) and the
 * server CSV export, so that "export current view" yields exactly what is shown.
 * Filters are serialized to URL query params with Italian names.
 */
import {
  PRIORITY_RANK,
  TASK_STATUS_RANK,
  isTaskPriority,
  isTaskStatus,
  type TaskPriority,
  type TaskStatus,
} from './enums';
import { isTaskOverdue } from './dates';
import { normalizeForSearch } from './format';
import type { TaskSummary } from './types';

export type AssigneeFilter = number | 'none';

export interface TaskFilters {
  q: string;
  assignees: AssigneeFilter[];
  priorities: TaskPriority[];
  statuses: TaskStatus[];
  overdue: boolean;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  q: '',
  assignees: [],
  priorities: [],
  statuses: [],
  overdue: false,
};

export const TASK_FILTER_PARAMS = {
  q: 'q',
  assignees: 'assegnatario',
  priorities: 'priorita',
  statuses: 'stato',
  overdue: 'ritardo',
} as const;

const UNASSIGNED_PARAM = 'nessuno';

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string {
  if (source instanceof URLSearchParams) return source.get(key) ?? '';
  const value = source[key];
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Parses filters from URL params, silently dropping unknown values. */
export function parseTaskFilters(source: ParamSource): TaskFilters {
  const assignees: AssigneeFilter[] = [];
  for (const raw of splitList(readParam(source, TASK_FILTER_PARAMS.assignees))) {
    if (raw === UNASSIGNED_PARAM) assignees.push('none');
    else if (/^\d+$/.test(raw)) assignees.push(Number(raw));
  }
  const overdueRaw = readParam(source, TASK_FILTER_PARAMS.overdue);
  return {
    q: readParam(source, TASK_FILTER_PARAMS.q).trim(),
    assignees: [...new Set(assignees)],
    priorities: [...new Set(splitList(readParam(source, TASK_FILTER_PARAMS.priorities)).filter(isTaskPriority))],
    statuses: [...new Set(splitList(readParam(source, TASK_FILTER_PARAMS.statuses)).filter(isTaskStatus))],
    overdue: overdueRaw === '1' || overdueRaw === 'true' || overdueRaw === 'si',
  };
}

/** Serializes filters to URL params (only non-empty values). */
export function taskFiltersToParams(filters: TaskFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q.trim()) params[TASK_FILTER_PARAMS.q] = filters.q.trim();
  if (filters.assignees.length > 0) {
    params[TASK_FILTER_PARAMS.assignees] = filters.assignees
      .map((a) => (a === 'none' ? UNASSIGNED_PARAM : String(a)))
      .join(',');
  }
  if (filters.priorities.length > 0) params[TASK_FILTER_PARAMS.priorities] = filters.priorities.join(',');
  if (filters.statuses.length > 0) params[TASK_FILTER_PARAMS.statuses] = filters.statuses.join(',');
  if (filters.overdue) params[TASK_FILTER_PARAMS.overdue] = '1';
  return params;
}

export function hasActiveTaskFilters(filters: TaskFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.assignees.length > 0 ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.overdue
  );
}

type FilterableTask = Pick<TaskSummary, 'title' | 'assigneeId' | 'priority' | 'status' | 'dueDate'>;

/** Returns a predicate; the search query is normalized once. */
export function createTaskMatcher(filters: TaskFilters, today: string): (task: FilterableTask) => boolean {
  const query = normalizeForSearch(filters.q);
  const assignees = new Set(filters.assignees);
  const priorities = new Set(filters.priorities);
  const statuses = new Set(filters.statuses);

  return (task) => {
    if (statuses.size > 0 && !statuses.has(task.status)) return false;
    if (priorities.size > 0 && !priorities.has(task.priority)) return false;
    if (assignees.size > 0 && !assignees.has(task.assigneeId ?? 'none')) return false;
    if (filters.overdue && !isTaskOverdue(task, today)) return false;
    if (query && !normalizeForSearch(task.title).includes(query)) return false;
    return true;
  };
}

export function filterTasks<T extends FilterableTask>(tasks: readonly T[], filters: TaskFilters, today: string): T[] {
  if (!hasActiveTaskFilters(filters)) return [...tasks];
  return tasks.filter(createTaskMatcher(filters, today));
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export const TASK_SORT_KEYS = ['position', 'title', 'status', 'priority', 'assignee', 'dueDate', 'estimate', 'updated'] as const;
export type TaskSortKey = (typeof TASK_SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

export function isTaskSortKey(value: unknown): value is TaskSortKey {
  return typeof value === 'string' && (TASK_SORT_KEYS as readonly string[]).includes(value);
}

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

function compareNullable<V>(a: V | null, b: V | null, cmp: (x: V, y: V) => number, dir: number): number {
  // Empty values always go last, regardless of direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp(a, b) * dir;
}

const byPosition = (a: TaskSummary, b: TaskSummary) =>
  TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status] || a.position - b.position || a.id - b.id;

export function sortTasks<T extends TaskSummary>(tasks: readonly T[], key: TaskSortKey, direction: SortDirection = 'asc'): T[] {
  const dir = direction === 'asc' ? 1 : -1;
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    let result = 0;
    switch (key) {
      case 'position':
        return byPosition(a, b) * dir;
      case 'title':
        result = collator.compare(a.title, b.title) * dir;
        break;
      case 'status':
        result = (TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status]) * dir;
        break;
      case 'priority':
        result = (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * dir;
        break;
      case 'assignee':
        result = compareNullable(a.assigneeName, b.assigneeName, collator.compare, dir);
        break;
      case 'dueDate':
        result = compareNullable(a.dueDate, b.dueDate, (x, y) => (x < y ? -1 : x > y ? 1 : 0), dir);
        break;
      case 'estimate':
        result = compareNullable(a.estimateHours, b.estimateHours, (x, y) => x - y, dir);
        break;
      case 'updated':
        result = (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0) * dir;
        break;
    }
    return result || byPosition(a, b);
  });
  return sorted;
}
