import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  LIMITS,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  dateOnlySchema,
  isIsoDateTime,
  memberFields,
  type BackupValidationReport,
  type EntityCounts,
  type RestoreResult,
} from '@gp/shared';
import { nowIso } from '../clock';
import type { Database } from '../db/database';
import { SCHEMA_VERSION } from '../db/migrations';
import { AppError } from '../errors';
import type { ServiceContext } from './context';

export const BACKUP_APP_ID = 'gestione-progetti';
export const BACKUP_FORMAT_VERSION = 1;
const MAX_REPORTED_ERRORS = 100;

// ---------------------------------------------------------------------------
// File format
// ---------------------------------------------------------------------------

const id = z.number({ error: 'Deve essere un numero intero positivo' }).int().positive();
const timestamp = z.string({ error: 'Data/ora mancante' }).refine(isIsoDateTime, { error: 'Data/ora non valida' });
const text = (max: number) => z.string({ error: 'Testo mancante' }).max(max, { error: `Massimo ${max} caratteri` });
const requiredText = (max: number) => text(max).trim().min(1, { error: 'Il valore non può essere vuoto' });

const backupMemberSchema = z.object({
  id,
  name: memberFields.name,
  email: memberFields.email,
  role: memberFields.role,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const backupProjectSchema = z.object({
  id,
  name: requiredText(LIMITS.projectName),
  description: text(LIMITS.projectDescription),
  status: z.enum(PROJECT_STATUSES, { error: 'Stato del progetto non valido' }),
  startDate: dateOnlySchema,
  dueDate: dateOnlySchema.nullable(),
  ownerId: id,
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const backupTaskSchema = z.object({
  id,
  projectId: id,
  title: requiredText(LIMITS.taskTitle),
  description: text(LIMITS.taskDescription),
  status: z.enum(TASK_STATUSES, { error: "Stato dell'attività non valido" }),
  priority: z.enum(TASK_PRIORITIES, { error: 'Priorità non valida' }),
  assigneeId: id.nullable(),
  dueDate: dateOnlySchema.nullable(),
  estimateHours: z.number().positive().max(LIMITS.estimateHours).nullable(),
  position: z.number().refine(Number.isFinite, { error: 'Posizione non valida' }),
  completedAt: timestamp.nullable(),
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const backupCommentSchema = z.object({
  id,
  taskId: id,
  authorId: id.nullable(),
  authorName: requiredText(LIMITS.memberName),
  body: requiredText(LIMITS.commentBody),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export interface BackupData {
  members: z.infer<typeof backupMemberSchema>[];
  projects: z.infer<typeof backupProjectSchema>[];
  tasks: z.infer<typeof backupTaskSchema>[];
  comments: z.infer<typeof backupCommentSchema>[];
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  schemaVersion?: number;
  data: BackupData;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function exportData(db: Database): BackupData {
  return {
    members: db.all<BackupData['members'][number]>(
      'SELECT id, name, email, role, created_at AS createdAt, updated_at AS updatedAt FROM members ORDER BY id',
    ),
    projects: db.all<BackupData['projects'][number]>(
      `SELECT id, name, description, status, start_date AS startDate, due_date AS dueDate, owner_id AS ownerId,
         version, created_at AS createdAt, updated_at AS updatedAt FROM projects ORDER BY id`,
    ),
    tasks: db.all<BackupData['tasks'][number]>(
      `SELECT id, project_id AS projectId, title, description, status, priority, assignee_id AS assigneeId,
         due_date AS dueDate, estimate_hours AS estimateHours, position, completed_at AS completedAt, version,
         created_at AS createdAt, updated_at AS updatedAt FROM tasks ORDER BY id`,
    ),
    comments: db.all<BackupData['comments'][number]>(
      `SELECT id, task_id AS taskId, author_id AS authorId, author_name AS authorName, body,
         created_at AS createdAt, updated_at AS updatedAt FROM comments ORDER BY id`,
    ),
  };
}

export function exportBackup(ctx: ServiceContext): BackupFile {
  // Rows from node:sqlite have a null prototype: spread them into plain objects.
  const data = exportData(ctx.db);
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(ctx.clock),
    schemaVersion: SCHEMA_VERSION,
    data: {
      members: data.members.map((r) => ({ ...r })),
      projects: data.projects.map((r) => ({ ...r })),
      tasks: data.tasks.map((r) => ({ ...r })),
      comments: data.comments.map((r) => ({ ...r })),
    },
  };
}

export function currentCounts(db: Database): EntityCounts {
  return db.get<EntityCounts>(
    `SELECT (SELECT COUNT(*) FROM members) AS members, (SELECT COUNT(*) FROM projects) AS projects,
            (SELECT COUNT(*) FROM tasks) AS tasks, (SELECT COUNT(*) FROM comments) AS comments`,
  )!;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((segment, index) => (typeof segment === 'number' ? `[${segment}]` : index === 0 ? String(segment) : `.${String(segment)}`))
    .join('');
}

class ErrorCollector {
  readonly errors: { path: string; message: string }[] = [];
  truncated = false;

  add(path: string, message: string): void {
    if (this.errors.length >= MAX_REPORTED_ERRORS) {
      this.truncated = true;
      return;
    }
    this.errors.push({ path, message });
  }
}

function countsOf(value: unknown): EntityCounts | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = (value as { data?: Record<string, unknown> }).data;
  if (typeof data !== 'object' || data === null) return null;
  const len = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0);
  return { members: len('members'), projects: len('projects'), tasks: len('tasks'), comments: len('comments') };
}

type Indexed<T> = { index: number; item: T }[];

interface ParsedCollections {
  members: Indexed<BackupData['members'][number]>;
  projects: Indexed<BackupData['projects'][number]>;
  tasks: Indexed<BackupData['tasks'][number]>;
  comments: Indexed<BackupData['comments'][number]>;
}

/** Ids present in the raw file (also for items that failed validation, to avoid false "missing" errors). */
function rawIds(items: unknown[]): Set<number> {
  const ids = new Set<number>();
  for (const item of items) {
    const id = (item as { id?: unknown } | null)?.id;
    if (typeof id === 'number') ids.add(id);
  }
  return ids;
}

/** Referential integrity and business invariants, checked on the items that are structurally valid. */
function checkConsistency(raw: Record<keyof ParsedCollections, unknown[]>, data: ParsedCollections, errors: ErrorCollector): void {
  for (const collection of ['members', 'projects', 'tasks', 'comments'] as const) {
    const seen = new Set<number>();
    raw[collection].forEach((item, index) => {
      const id = (item as { id?: unknown } | null)?.id;
      if (typeof id !== 'number') return;
      if (seen.has(id)) errors.add(`data.${collection}[${index}].id`, `Identificativo ${id} duplicato`);
      seen.add(id);
    });
  }

  const memberIds = rawIds(raw.members);
  const projectIds = rawIds(raw.projects);
  const taskIds = rawIds(raw.tasks);

  const emails = new Set<string>();
  for (const { index, item } of data.members) {
    const key = item.email.toLowerCase();
    if (emails.has(key)) errors.add(`data.members[${index}].email`, `L'email "${item.email}" è usata da più membri`);
    emails.add(key);
  }

  const projectsById = new Map(data.projects.map(({ item }) => [item.id, item]));
  for (const { index, item: p } of data.projects) {
    if (!memberIds.has(p.ownerId)) errors.add(`data.projects[${index}].ownerId`, `Il responsabile (membro ${p.ownerId}) non esiste`);
    if (p.dueDate && p.dueDate < p.startDate) errors.add(`data.projects[${index}].dueDate`, 'La scadenza precede la data di inizio');
  }

  for (const { index, item: t } of data.tasks) {
    if (!projectIds.has(t.projectId)) errors.add(`data.tasks[${index}].projectId`, `Il progetto ${t.projectId} non esiste`);
    if (t.assigneeId !== null && !memberIds.has(t.assigneeId)) {
      errors.add(`data.tasks[${index}].assigneeId`, `L'assegnatario (membro ${t.assigneeId}) non esiste`);
    }
    const project = projectsById.get(t.projectId);
    if (!project) continue;
    if (t.dueDate && project.dueDate && t.dueDate > project.dueDate) {
      errors.add(`data.tasks[${index}].dueDate`, `La scadenza supera quella del progetto "${project.name}"`);
    }
    if (project.status === 'completato' && t.status !== 'fatto') {
      errors.add(`data.tasks[${index}].status`, `Il progetto "${project.name}" è completato ma l'attività non è fatta`);
    }
  }

  for (const { index, item: c } of data.comments) {
    if (!taskIds.has(c.taskId)) errors.add(`data.comments[${index}].taskId`, `L'attività ${c.taskId} non esiste`);
    if (c.authorId !== null && !memberIds.has(c.authorId)) {
      errors.add(`data.comments[${index}].authorId`, `L'autore (membro ${c.authorId}) non esiste`);
    }
  }
}

const envelopeSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION, { error: 'Versione del formato non supportata' }),
  exportedAt: timestamp,
  schemaVersion: z.number().int().optional(),
  data: z.object(
    {
      members: z.array(z.unknown(), { error: 'Elenco dei membri mancante' }),
      projects: z.array(z.unknown(), { error: 'Elenco dei progetti mancante' }),
      tasks: z.array(z.unknown(), { error: 'Elenco delle attività mancante' }),
      comments: z.array(z.unknown(), { error: 'Elenco dei commenti mancante' }),
    },
    { error: 'Sezione "data" mancante' },
  ),
});

/**
 * Checks a backup file without touching the database. Each item is validated on its own,
 * so a single pass reports every problem (structure, references and business rules).
 */
export function validateBackup(
  db: Database,
  payload: unknown,
): { report: BackupValidationReport; data: BackupData | null } {
  const errors = new ErrorCollector();
  const report = (data: BackupData | null, extra?: Partial<BackupValidationReport['file']>) => ({
    report: {
      valid: errors.errors.length === 0 && data !== null,
      errors: errors.errors,
      truncated: errors.truncated,
      file: {
        exportedAt: null,
        formatVersion: null,
        counts: countsOf(payload),
        ...extra,
      },
      current: currentCounts(db),
    },
    data: errors.errors.length === 0 ? data : null,
  });

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.add('(file)', 'Il file non contiene un backup valido');
    return report(null);
  }
  const envelope = payload as Record<string, unknown>;
  const meta = {
    exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : null,
    formatVersion: typeof envelope.formatVersion === 'number' ? envelope.formatVersion : null,
  };
  if (envelope.app !== BACKUP_APP_ID) {
    errors.add('app', "Il file non è un backup di quest'applicazione");
    return report(null, meta);
  }
  if (typeof envelope.formatVersion === 'number' && envelope.formatVersion > BACKUP_FORMAT_VERSION) {
    errors.add('formatVersion', "Il backup è stato creato da una versione più recente dell'applicazione");
    return report(null, meta);
  }

  const parsedEnvelope = envelopeSchema.safeParse(payload);
  if (!parsedEnvelope.success) {
    for (const issue of parsedEnvelope.error.issues) errors.add(formatPath(issue.path) || '(file)', issue.message);
    return report(null, meta);
  }
  const raw = parsedEnvelope.data.data;

  const parseItems = <T>(collection: keyof ParsedCollections, schema: z.ZodType<T>): Indexed<T> => {
    const result: Indexed<T> = [];
    raw[collection].forEach((item, index) => {
      const parsed = schema.safeParse(item);
      if (parsed.success) result.push({ index, item: parsed.data });
      else for (const issue of parsed.error.issues) errors.add(formatPath(['data', collection, index, ...issue.path]), issue.message);
    });
    return result;
  };
  const collections: ParsedCollections = {
    members: parseItems('members', backupMemberSchema),
    projects: parseItems('projects', backupProjectSchema),
    tasks: parseItems('tasks', backupTaskSchema),
    comments: parseItems('comments', backupCommentSchema),
  };
  checkConsistency(raw, collections, errors);

  const data: BackupData = {
    members: collections.members.map((x) => x.item),
    projects: collections.projects.map((x) => x.item),
    tasks: collections.tasks.map((x) => x.item),
    comments: collections.comments.map((x) => x.item),
  };
  return report(data, meta);
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/** Replaces all data atomically, preserving identifiers. */
export function replaceAllData(db: Database, data: BackupData): void {
  db.transaction(() => {
    db.exec(`
      DELETE FROM comments;
      DELETE FROM tasks;
      DELETE FROM projects;
      DELETE FROM members;
      DELETE FROM sqlite_sequence WHERE name IN ('comments', 'tasks', 'projects', 'members');
    `);
    for (const m of data.members) {
      db.run(
        `INSERT INTO members (id, name, email, role, created_at, updated_at)
         VALUES (:id, :name, :email, :role, :createdAt, :updatedAt)`,
        { id: m.id, name: m.name, email: m.email, role: m.role, createdAt: m.createdAt, updatedAt: m.updatedAt },
      );
    }
    for (const p of data.projects) {
      db.run(
        `INSERT INTO projects (id, name, description, status, start_date, due_date, owner_id, version, created_at, updated_at)
         VALUES (:id, :name, :description, :status, :startDate, :dueDate, :ownerId, :version, :createdAt, :updatedAt)`,
        {
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          startDate: p.startDate,
          dueDate: p.dueDate,
          ownerId: p.ownerId,
          version: p.version,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      );
    }
    for (const t of data.tasks) {
      db.run(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date, estimate_hours,
           position, completed_at, version, created_at, updated_at)
         VALUES (:id, :projectId, :title, :description, :status, :priority, :assigneeId, :dueDate, :estimateHours,
           :position, :completedAt, :version, :createdAt, :updatedAt)`,
        {
          id: t.id,
          projectId: t.projectId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate,
          estimateHours: t.estimateHours,
          position: t.position,
          completedAt: t.completedAt,
          version: t.version,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        },
      );
    }
    for (const c of data.comments) {
      db.run(
        `INSERT INTO comments (id, task_id, author_id, author_name, body, created_at, updated_at)
         VALUES (:id, :taskId, :authorId, :authorName, :body, :createdAt, :updatedAt)`,
        {
          id: c.id,
          taskId: c.taskId,
          authorId: c.authorId,
          authorName: c.authorName,
          body: c.body,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        },
      );
    }
  });
}

const fileStampFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** "2026-11-08_18-30-05" in Europe/Rome, safe for file names. */
export function fileStamp(date: Date): string {
  const parts = Object.fromEntries(fileStampFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`;
}

/** Writes a JSON export of the current data to `dir` (if there is any data). Returns the file name. */
export function writeSnapshot(ctx: ServiceContext, dir: string, prefix: string): string | null {
  const counts = currentCounts(ctx.db);
  if (counts.members + counts.projects + counts.tasks + counts.comments === 0) return null;
  mkdirSync(dir, { recursive: true });
  const name = `${prefix}-${fileStamp(ctx.clock.now())}.json`;
  writeFileSync(join(dir, name), JSON.stringify(exportBackup(ctx), null, 2), 'utf8');
  return name;
}

export function restoreBackup(ctx: ServiceContext, payload: unknown): RestoreResult {
  const { report, data } = validateBackup(ctx.db, payload);
  if (!report.valid || !data) {
    throw new AppError(422, 'BACKUP_INVALID', 'Il file di backup non è valido: nessun dato è stato modificato.', report);
  }
  const snapshot = ctx.backupDir ? writeSnapshot(ctx, ctx.backupDir, 'pre-ripristino') : null;
  replaceAllData(ctx.db, data);
  return {
    restored: { members: data.members.length, projects: data.projects.length, tasks: data.tasks.length, comments: data.comments.length },
    snapshot,
  };
}
