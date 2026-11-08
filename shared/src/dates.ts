/**
 * Date utilities.
 *
 * Two kinds of temporal values exist in the app:
 *  - "date-only" values (`YYYY-MM-DD`): calendar dates such as due dates. They carry no
 *    time zone and are never shifted; they are interpreted as calendar days in Europe/Rome.
 *  - timestamps (ISO 8601 in UTC, e.g. `2026-11-08T16:45:00.000Z`): they are always
 *    displayed converted to Europe/Rome.
 *
 * "Today" is always computed in Europe/Rome, regardless of the machine time zone.
 */
import type { TaskStatus } from './enums';

export const APP_TIME_ZONE = 'Europe/Rome';
export const APP_LOCALE = 'it-IT';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const romeYmdFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const found = parts.find((p) => p.type === type);
  if (!found) throw new Error(`Parte di data mancante: ${type}`);
  return found.value;
}

/** Calendar date (YYYY-MM-DD) of the given instant in Europe/Rome. */
export function toRomeDateString(date: Date): string {
  const parts = romeYmdFormatter.formatToParts(date);
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

/** Today's calendar date in Europe/Rome. */
export function todayInRome(now: Date = new Date()): string {
  return toRomeDateString(now);
}

function parseDateOnly(value: string): { y: number; m: number; d: number } | null {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isValidDateOnly(value: string): boolean {
  const parsed = parseDateOnly(value);
  if (!parsed) return false;
  const { y, m, d } = parsed;
  if (y < 1900 || y > 2999) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function dateOnlyToUtcMs(value: string): number {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`Data non valida: ${value}`);
  return Date.UTC(parsed.y, parsed.m - 1, parsed.d);
}

/** Adds (or subtracts) whole days to a date-only value. */
export function addDays(value: string, days: number): string {
  return new Date(dateOnlyToUtcMs(value) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Number of calendar days from `b` to `a` (positive when `a` is later). */
export function diffInDays(a: string, b: string): number {
  return Math.round((dateOnlyToUtcMs(a) - dateOnlyToUtcMs(b)) / MS_PER_DAY);
}

export function isTaskOverdue(task: { status: TaskStatus; dueDate: string | null }, today: string): boolean {
  return task.status !== 'fatto' && task.dueDate !== null && task.dueDate < today;
}

export function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export type DateStyle = 'medium' | 'long' | 'numeric' | 'short';

const dateOnlyFormatters: Record<DateStyle, Intl.DateTimeFormat> = {
  medium: new Intl.DateTimeFormat(APP_LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }),
  long: new Intl.DateTimeFormat(APP_LOCALE, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  numeric: new Intl.DateTimeFormat(APP_LOCALE, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }),
  short: new Intl.DateTimeFormat(APP_LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short' }),
};

/**
 * Formats a date-only value. The value is a calendar day, so it is rendered as-is
 * (formatting at UTC noon in UTC guarantees no day shift).
 */
export function formatDate(value: string | null | undefined, style: DateStyle = 'medium'): string {
  if (!value) return '';
  const parsed = parseDateOnly(value);
  if (!parsed) return value;
  return dateOnlyFormatters[style].format(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12)));
}

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const numericDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Formats a UTC timestamp in Europe/Rome, e.g. "8 nov 2026, 17:45" or "08/11/2026 17:45". */
export function formatDateTime(iso: string | null | undefined, style: 'medium' | 'numeric' = 'medium'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (style === 'numeric') {
    const parts = numericDateTimeFormatter.formatToParts(date);
    return `${part(parts, 'day')}/${part(parts, 'month')}/${part(parts, 'year')} ${part(parts, 'hour')}:${part(parts, 'minute')}`;
  }
  return dateTimeFormatter.format(date);
}

const relativeFormatter = new Intl.RelativeTimeFormat('it', { numeric: 'auto' });

/** Human relative time ("5 minuti fa", "ieri"), falling back to an absolute date after a week. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return 'adesso';
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour');
  const dayDiff = diffInDays(toRomeDateString(date), toRomeDateString(now));
  if (Math.abs(dayDiff) < 7) return relativeFormatter.format(dayDiff, 'day');
  return formatDateTime(iso);
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal' | 'done';

/** Short Italian description of a due date relative to today. */
export function describeDueDate(dueDate: string, today: string, done = false): { label: string; tone: DueTone } {
  if (done) return { label: formatDate(dueDate), tone: 'done' };
  const diff = diffInDays(dueDate, today);
  if (diff < -1) return { label: `Scaduta da ${-diff} giorni`, tone: 'overdue' };
  if (diff === -1) return { label: 'Scaduta ieri', tone: 'overdue' };
  if (diff === 0) return { label: 'Scade oggi', tone: 'today' };
  if (diff === 1) return { label: 'Scade domani', tone: 'soon' };
  if (diff <= 7) return { label: `Tra ${diff} giorni`, tone: 'soon' };
  return { label: formatDate(dueDate), tone: 'normal' };
}
