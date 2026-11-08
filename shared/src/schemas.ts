/**
 * Input schemas shared by server (authoritative validation) and client (inline form feedback).
 *
 * Note: no `.default()` is used on purpose. In zod 4 defaults also apply inside
 * optional/partial schemas, which would silently reset fields on partial updates.
 * Defaults are applied by the server services instead.
 */
import { z } from 'zod';
// Import only the Italian locale (z.locales would bundle every language).
import italian from 'zod/v4/locales/it.js';
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from './enums';
import { isValidDateOnly } from './dates';

z.config(italian());

export const LIMITS = {
  memberName: 100,
  email: 254,
  role: 60,
  projectName: 120,
  projectDescription: 5000,
  taskTitle: 200,
  taskDescription: 10000,
  commentBody: 5000,
  estimateHours: 10000,
} as const;

export const dateOnlySchema = z
  .string({ error: 'Data non valida' })
  .refine(isValidDateOnly, { error: 'Data non valida (formato atteso AAAA-MM-GG)' });

export const idSchema = z.number({ error: 'Valore non valido' }).int().positive();

const requiredText = (max: number, requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .min(1, { error: requiredMessage })
    .max(max, { error: `Massimo ${max} caratteri` });

const optionalText = (max: number) =>
  z.string().trim().max(max, { error: `Massimo ${max} caratteri` });

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberFields = {
  name: requiredText(LIMITS.memberName, 'Il nome è obbligatorio'),
  email: z
    .string({ error: "L'email è obbligatoria" })
    .trim()
    .toLowerCase()
    .min(1, { error: "L'email è obbligatoria" })
    .max(LIMITS.email, { error: `Massimo ${LIMITS.email} caratteri` })
    .pipe(z.email({ error: 'Email non valida' })),
  role: requiredText(LIMITS.role, 'Il ruolo è obbligatorio'),
};

export const memberCreateSchema = z.object(memberFields);
export const memberUpdateSchema = z.object(memberFields).partial();
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projectFields = {
  name: requiredText(LIMITS.projectName, 'Il nome del progetto è obbligatorio'),
  description: optionalText(LIMITS.projectDescription),
  status: z.enum(PROJECT_STATUSES, { error: 'Stato non valido' }),
  startDate: dateOnlySchema,
  dueDate: dateOnlySchema.nullable(),
  ownerId: idSchema,
};

const dueAfterStart = (data: { startDate?: string; dueDate?: string | null }) =>
  !data.startDate || !data.dueDate || data.dueDate >= data.startDate;

const DUE_BEFORE_START_MESSAGE = 'La scadenza non può precedere la data di inizio';

export const projectCreateSchema = z
  .object({
    ...projectFields,
    description: projectFields.description.optional(),
    dueDate: projectFields.dueDate.optional(),
    status: z
      .enum(['attivo', 'in_pausa', 'completato'], { error: 'Stato iniziale non valido' })
      .optional(),
  })
  .refine(dueAfterStart, { path: ['dueDate'], error: DUE_BEFORE_START_MESSAGE });

export const projectUpdateSchema = z
  .object(projectFields)
  .partial()
  .extend({ version: z.number().int().positive() })
  .refine(dueAfterStart, { path: ['dueDate'], error: DUE_BEFORE_START_MESSAGE });

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const PROJECT_SORTS = ['due', 'progress', 'name', 'created'] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const taskFields = {
  title: requiredText(LIMITS.taskTitle, 'Il titolo è obbligatorio'),
  description: optionalText(LIMITS.taskDescription),
  status: z.enum(TASK_STATUSES, { error: 'Stato non valido' }),
  priority: z.enum(TASK_PRIORITIES, { error: 'Priorità non valida' }),
  assigneeId: idSchema.nullable(),
  dueDate: dateOnlySchema.nullable(),
  estimateHours: z
    .number({ error: 'Inserisci un numero' })
    .positive({ error: 'La stima deve essere maggiore di zero' })
    .max(LIMITS.estimateHours, { error: `La stima non può superare ${LIMITS.estimateHours} ore` })
    .nullable(),
};

export const taskCreateSchema = z.object(taskFields).partial().required({ title: true });
export const taskUpdateSchema = z
  .object(taskFields)
  .partial()
  .extend({ version: z.number().int().positive() });

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const taskMoveSchema = z.object({
  status: z.enum(TASK_STATUSES, { error: 'Stato non valido' }),
  /** Task displayed right above the moved one in the target column (null = top). */
  prevId: idSchema.nullable().optional(),
  /** Task displayed right below the moved one in the target column (null = bottom). */
  nextId: idSchema.nullable().optional(),
});
export type TaskMoveInput = z.infer<typeof taskMoveSchema>;

/** Client-side check mirroring the server rule; returns an error message or null. */
export function taskDueDateError(dueDate: string | null | undefined, projectDueDate: string | null | undefined): string | null {
  if (!dueDate || !projectDueDate) return null;
  if (dueDate > projectDueDate) {
    return 'La scadenza non può superare quella del progetto';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const commentCreateSchema = z.object({
  body: requiredText(LIMITS.commentBody, 'Il commento non può essere vuoto'),
  authorId: idSchema,
});
export const commentUpdateSchema = z.object({
  body: requiredText(LIMITS.commentBody, 'Il commento non può essere vuoto'),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentUpdateInput = z.infer<typeof commentUpdateSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flattens zod issues to `{ "field.path": "first message" }`. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
