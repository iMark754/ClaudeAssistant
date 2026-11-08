import { describe, expect, it } from 'vitest';
import {
  memberCreateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  taskCreateSchema,
  taskDueDateError,
  taskUpdateSchema,
  zodFieldErrors,
} from '../src/schemas';
import { initials, normalizeForSearch, progressPercent } from '../src/format';

describe('schemas', () => {
  it('normalizes member email and reports Italian errors', () => {
    expect(memberCreateSchema.parse({ name: ' Giulia ', email: ' Giulia@Example.COM ', role: 'PM' })).toEqual({
      name: 'Giulia',
      email: 'giulia@example.com',
      role: 'PM',
    });
    const result = memberCreateSchema.safeParse({ name: '', email: 'nope', role: 'PM' });
    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({ name: 'Il nome è obbligatorio', email: 'Email non valida' });
  });

  it('rejects a project due date before the start date', () => {
    const result = projectCreateSchema.safeParse({ name: 'X', startDate: '2026-11-10', dueDate: '2026-11-01', ownerId: 1 });
    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).dueDate).toMatch(/precedere/);
  });

  it('does not apply defaults to partial updates', () => {
    expect(projectUpdateSchema.parse({ version: 3, name: 'Nuovo nome' })).toEqual({ version: 3, name: 'Nuovo nome' });
    expect(taskUpdateSchema.parse({ version: 1, status: 'fatto' })).toEqual({ version: 1, status: 'fatto' });
  });

  it('requires a task title and validates estimates and dates', () => {
    expect(taskCreateSchema.safeParse({}).success).toBe(false);
    const result = taskCreateSchema.safeParse({ title: 'T', estimateHours: -2, dueDate: '2026-02-30' });
    expect(Object.keys(zodFieldErrors(result.error!)).sort()).toEqual(['dueDate', 'estimateHours']);
  });

  it('checks task due date against the project due date', () => {
    expect(taskDueDateError('2026-12-01', '2026-11-30')).toMatch(/non può superare/);
    expect(taskDueDateError('2026-11-30', '2026-11-30')).toBeNull();
    expect(taskDueDateError('2026-12-01', null)).toBeNull();
  });
});

describe('format helpers', () => {
  it('computes initials, progress and search normalization', () => {
    expect(initials('Giulia Romano')).toBe('GR');
    expect(initials('  luca  ')).toBe('L');
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(0, 0)).toBe(0);
    expect(normalizeForSearch('Perché è Così')).toBe('perche e cosi');
  });
});
