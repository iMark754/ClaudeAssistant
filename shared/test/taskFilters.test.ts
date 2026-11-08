import { describe, expect, it } from 'vitest';
import {
  EMPTY_TASK_FILTERS,
  filterTasks,
  hasActiveTaskFilters,
  parseTaskFilters,
  sortTasks,
  taskFiltersToParams,
} from '../src/taskFilters';
import type { TaskSummary } from '../src/types';

function task(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    id: 1,
    projectId: 1,
    title: 'Attività',
    status: 'da_fare',
    priority: 'media',
    assigneeId: null,
    assigneeName: null,
    dueDate: null,
    estimateHours: null,
    position: 1024,
    commentCount: 0,
    version: 1,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

const today = '2026-11-08';
const tasks: TaskSummary[] = [
  task({ id: 1, title: 'Revisione testi', status: 'in_revisione', priority: 'alta', assigneeId: 1, assigneeName: 'Giulia', dueDate: '2026-11-05', position: 1024 }),
  task({ id: 2, title: 'Integrazione CRM', status: 'in_corso', priority: 'urgente', assigneeId: 2, assigneeName: 'Luca', dueDate: '2026-11-20', position: 1024 }),
  task({ id: 3, title: 'Attività di test', status: 'da_fare', priority: 'bassa', dueDate: '2026-11-01', position: 2048 }),
  task({ id: 4, title: 'Pubblicazione', status: 'fatto', priority: 'media', assigneeId: 1, assigneeName: 'Giulia', dueDate: '2026-11-02', position: 1024 }),
  task({ id: 5, title: 'Analisi', status: 'da_fare', priority: 'media', assigneeId: 2, assigneeName: 'Luca', position: 1024 }),
];

describe('task filters', () => {
  it('returns everything without filters', () => {
    expect(filterTasks(tasks, EMPTY_TASK_FILTERS, today)).toHaveLength(5);
    expect(hasActiveTaskFilters(EMPTY_TASK_FILTERS)).toBe(false);
  });

  it('filters by assignee including unassigned', () => {
    const ids = (f: Partial<typeof EMPTY_TASK_FILTERS>) =>
      filterTasks(tasks, { ...EMPTY_TASK_FILTERS, ...f }, today).map((t) => t.id);
    expect(ids({ assignees: [1] })).toEqual([1, 4]);
    expect(ids({ assignees: ['none'] })).toEqual([3]);
    expect(ids({ assignees: [2, 'none'] })).toEqual([2, 3, 5]);
  });

  it('filters by priority, status and overdue (done tasks are never overdue)', () => {
    const ids = (f: Partial<typeof EMPTY_TASK_FILTERS>) =>
      filterTasks(tasks, { ...EMPTY_TASK_FILTERS, ...f }, today).map((t) => t.id);
    expect(ids({ priorities: ['alta', 'urgente'] })).toEqual([1, 2]);
    expect(ids({ statuses: ['da_fare'] })).toEqual([3, 5]);
    expect(ids({ overdue: true })).toEqual([1, 3]);
    expect(ids({ overdue: true, assignees: [1] })).toEqual([1]);
  });

  it('searches titles ignoring case and accents', () => {
    const ids = (q: string) => filterTasks(tasks, { ...EMPTY_TASK_FILTERS, q }, today).map((t) => t.id);
    expect(ids('attivita')).toEqual([3]);
    expect(ids('CRM')).toEqual([2]);
    expect(ids('  revisione ')).toEqual([1]);
  });

  it('round-trips through URL params and ignores garbage', () => {
    const filters = { q: 'crm', assignees: [2, 'none' as const], priorities: ['alta' as const], statuses: ['in_corso' as const], overdue: true };
    const params = new URLSearchParams(taskFiltersToParams(filters));
    expect(params.toString()).toBe('q=crm&assegnatario=2%2Cnessuno&priorita=alta&stato=in_corso&ritardo=1');
    expect(parseTaskFilters(params)).toEqual(filters);
    expect(parseTaskFilters(new URLSearchParams('priorita=altissima,bassa&stato=boh&assegnatario=x,3'))).toEqual({
      ...EMPTY_TASK_FILTERS,
      priorities: ['bassa'],
      assignees: [3],
    });
  });
});

describe('task sorting', () => {
  it('sorts by due date with empty values last in both directions', () => {
    expect(sortTasks(tasks, 'dueDate', 'asc').map((t) => t.id)).toEqual([3, 4, 1, 2, 5]);
    expect(sortTasks(tasks, 'dueDate', 'desc').map((t) => t.id)).toEqual([2, 1, 4, 3, 5]);
  });

  it('sorts by priority and by board position', () => {
    expect(sortTasks(tasks, 'priority', 'desc').map((t) => t.id)[0]).toBe(2);
    expect(sortTasks(tasks, 'position').map((t) => t.id)).toEqual([5, 3, 2, 1, 4]);
  });
});
