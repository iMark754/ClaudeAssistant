import { APP_LOCALE } from './dates';

const hoursFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 2 });

/** "1,5" — decimal comma, up to two decimals. */
export function formatNumber(value: number): string {
  return hoursFormatter.format(value);
}

/** "1,5 h" */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return `${hoursFormatter.format(value)} h`;
}

/** Italian plural helper: plural(1, 'attività', 'attività') */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Lowercase + strip diacritics, for accent-insensitive search ("attivita" matches "Attività"). */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Initials for avatars: "Giulia Romano" -> "GR". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

/** Progress percentage (0-100, integer). */
export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}
