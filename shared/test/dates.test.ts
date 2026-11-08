import { describe, expect, it } from 'vitest';
import {
  addDays,
  describeDueDate,
  diffInDays,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isIsoDateTime,
  isTaskOverdue,
  isValidDateOnly,
  todayInRome,
} from '../src/dates';

describe('todayInRome', () => {
  it('uses the Rome calendar day, not UTC, around midnight (winter, UTC+1)', () => {
    // 23:30 UTC on 8 Nov = 00:30 on 9 Nov in Rome
    expect(todayInRome(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09');
    expect(todayInRome(new Date('2026-11-08T22:59:59Z'))).toBe('2026-11-08');
  });

  it('handles summer time (UTC+2)', () => {
    // 22:30 UTC on 15 Jul = 00:30 on 16 Jul in Rome
    expect(todayInRome(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16');
    expect(todayInRome(new Date('2026-07-15T21:59:00Z'))).toBe('2026-07-15');
  });

  it('handles the DST switch days', () => {
    // DST starts 29 Mar 2026 at 01:00 UTC
    expect(todayInRome(new Date('2026-03-28T23:00:00Z'))).toBe('2026-03-29');
    // DST ends 25 Oct 2026 at 01:00 UTC
    expect(todayInRome(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25');
    expect(todayInRome(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });
});

describe('date-only helpers', () => {
  it('validates calendar dates', () => {
    expect(isValidDateOnly('2026-02-28')).toBe(true);
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('2026-1-01')).toBe(false);
    expect(isValidDateOnly('oggi')).toBe(false);
  });

  it('adds days across months, years and DST changes', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('computes day differences', () => {
    expect(diffInDays('2026-11-10', '2026-11-08')).toBe(2);
    expect(diffInDays('2026-03-30', '2026-03-28')).toBe(2);
    expect(diffInDays('2026-11-01', '2026-11-08')).toBe(-7);
  });

  it('detects overdue tasks', () => {
    const today = '2026-11-08';
    expect(isTaskOverdue({ status: 'in_corso', dueDate: '2026-11-07' }, today)).toBe(true);
    expect(isTaskOverdue({ status: 'in_corso', dueDate: '2026-11-08' }, today)).toBe(false);
    expect(isTaskOverdue({ status: 'fatto', dueDate: '2026-11-01' }, today)).toBe(false);
    expect(isTaskOverdue({ status: 'da_fare', dueDate: null }, today)).toBe(false);
  });

  it('validates ISO timestamps', () => {
    expect(isIsoDateTime('2026-11-08T16:45:00.000Z')).toBe(true);
    expect(isIsoDateTime('2026-11-08T16:45:00+01:00')).toBe(true);
    expect(isIsoDateTime('2026-11-08')).toBe(false);
    expect(isIsoDateTime('ieri')).toBe(false);
  });
});

describe('formatting', () => {
  it('formats date-only values without time zone shifts', () => {
    expect(formatDate('2026-11-12')).toBe('12 nov 2026');
    expect(formatDate('2026-11-12', 'numeric')).toBe('12/11/2026');
    expect(formatDate('2026-11-08', 'long')).toBe('domenica 8 novembre 2026');
    expect(formatDate(null)).toBe('');
  });

  it('formats timestamps in Europe/Rome', () => {
    expect(formatDateTime('2026-11-08T16:45:00.000Z', 'numeric')).toBe('08/11/2026 17:45');
    expect(formatDateTime('2026-07-15T22:30:00.000Z', 'numeric')).toBe('16/07/2026 00:30');
    expect(formatDateTime('2026-11-08T16:45:00.000Z')).toMatch(/8 nov 2026.*17:45/);
  });

  it('formats relative times in Italian', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(formatRelativeTime('2026-11-08T11:59:50Z', now)).toBe('adesso');
    expect(formatRelativeTime('2026-11-08T11:55:00Z', now)).toBe('5 minuti fa');
    expect(formatRelativeTime('2026-11-08T09:00:00Z', now)).toBe('3 ore fa');
    expect(formatRelativeTime('2026-11-07T09:00:00Z', now)).toBe('ieri');
  });

  it('describes due dates relative to today', () => {
    const today = '2026-11-08';
    expect(describeDueDate('2026-11-05', today)).toEqual({ label: 'Scaduta da 3 giorni', tone: 'overdue' });
    expect(describeDueDate('2026-11-07', today)).toEqual({ label: 'Scaduta ieri', tone: 'overdue' });
    expect(describeDueDate('2026-11-08', today)).toEqual({ label: 'Scade oggi', tone: 'today' });
    expect(describeDueDate('2026-11-09', today)).toEqual({ label: 'Scade domani', tone: 'soon' });
    expect(describeDueDate('2026-11-13', today)).toEqual({ label: 'Tra 5 giorni', tone: 'soon' });
    expect(describeDueDate('2026-12-01', today).tone).toBe('normal');
    expect(describeDueDate('2026-11-01', today, true).tone).toBe('done');
  });
});
