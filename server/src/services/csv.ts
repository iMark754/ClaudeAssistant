import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  filterTasks,
  formatDate,
  formatDateTime,
  formatNumber,
  isTaskOverdue,
  isTaskSortKey,
  normalizeForSearch,
  parseTaskFilters,
  sortTasks,
} from '@gp/shared';
import { today as todayOf } from '../clock';
import { listProjectTasksWithDescription } from '../repositories/tasks';
import type { ServiceContext } from './context';
import { requireProjectRow } from './projects';

const SEPARATOR = ';';
/** Byte order mark: lets Excel detect UTF-8 (accents would be garbled otherwise). */
export const UTF8_BOM = String.fromCharCode(0xfeff);
const HEADERS = [
  'ID',
  'Titolo',
  'Descrizione',
  'Stato',
  'Priorità',
  'Assegnatario',
  'Email assegnatario',
  'Scadenza',
  'Stima (ore)',
  'In ritardo',
  'Commenti',
  'Creata il',
  'Aggiornata il',
  'Completata il',
];

/**
 * Escapes a CSV cell (RFC 4180) and neutralizes spreadsheet formula injection:
 * text starting with = + - @ (or tab/CR) is prefixed with an apostrophe.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text) || text !== text.trim()) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function slugify(value: string): string {
  const slug = normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || 'progetto';
}

/**
 * CSV of a project's tasks, honouring the same filter/sort query params as the list view.
 * Format: UTF-8 with BOM, ";" separator, CRLF, Italian labels, dates in Europe/Rome —
 * this opens correctly in Excel with Italian regional settings.
 */
export function exportProjectTasksCsv(
  ctx: ServiceContext,
  projectId: number,
  query: Record<string, string | undefined>,
): { filename: string; content: string } {
  const project = requireProjectRow(ctx, projectId);
  const today = todayOf(ctx.clock);
  const filters = parseTaskFilters(query);
  const sortKey = isTaskSortKey(query.ordina) ? query.ordina : 'position';
  const direction = query.dir === 'desc' ? 'desc' : 'asc';
  const rows = sortTasks(filterTasks(listProjectTasksWithDescription(ctx.db, projectId), filters, today), sortKey, direction);

  const lines = [HEADERS.map(escapeCsvCell).join(SEPARATOR)];
  for (const task of rows) {
    lines.push(
      [
        task.id,
        task.title,
        task.description,
        TASK_STATUS_LABELS[task.status],
        TASK_PRIORITY_LABELS[task.priority],
        task.assigneeName ?? '',
        task.assigneeEmail ?? '',
        formatDate(task.dueDate, 'numeric'),
        task.estimateHours === null ? '' : formatNumber(task.estimateHours),
        isTaskOverdue(task, today) ? 'Sì' : 'No',
        task.commentCount,
        formatDateTime(task.createdAt, 'numeric'),
        formatDateTime(task.updatedAt, 'numeric'),
        formatDateTime(task.completedAt, 'numeric'),
      ]
        .map(escapeCsvCell)
        .join(SEPARATOR),
    );
  }

  return {
    filename: `attivita-${slugify(project.name)}-${today}.csv`,
    content: `${UTF8_BOM}${lines.join('\r\n')}\r\n`,
  };
}
