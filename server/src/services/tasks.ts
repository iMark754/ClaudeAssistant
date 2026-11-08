import {
  formatDate,
  taskCreateSchema,
  taskMoveSchema,
  taskUpdateSchema,
  type MoveTaskResult,
  type Task,
  type TaskStatus,
  type TaskSummary,
} from '@gp/shared';
import { nowIso } from '../clock';
import type { Database } from '../db/database';
import { AppError, badRequest, fieldError, notFound, staleError } from '../errors';
import { memberExists } from '../repositories/members';
import type { ProjectRow } from '../repositories/projects';
import * as tasks from '../repositories/tasks';
import { assertProjectWritable, type ServiceContext } from './context';
import { requireProjectRow } from './projects';

export const POSITION_STEP = 1024;
const MIN_POSITION_GAP = 1e-6;

const taskNotFound = () => notFound('Attività non trovata');

const completedProjectError = () =>
  new AppError(
    409,
    'PROJECT_COMPLETED',
    'Il progetto è completato: può contenere solo attività fatte. Riporta il progetto in stato "Attivo" per aggiungere o riaprire attività.',
    undefined,
    'status',
  );

function requireTaskRow(ctx: ServiceContext, id: number): tasks.TaskRow {
  const row = tasks.findTaskRow(ctx.db, id);
  if (!row) throw taskNotFound();
  return row;
}

function assertAssignee(ctx: ServiceContext, assigneeId: number | null | undefined): void {
  if (assigneeId !== null && assigneeId !== undefined && !memberExists(ctx.db, assigneeId)) {
    throw fieldError('assigneeId', "L'assegnatario selezionato non esiste", 'INVALID_REFERENCE');
  }
}

function assertDueWithinProject(project: ProjectRow, dueDate: string | null | undefined): void {
  if (dueDate && project.due_date && dueDate > project.due_date) {
    throw fieldError(
      'dueDate',
      `La scadenza non può superare quella del progetto (${formatDate(project.due_date)})`,
      'TASK_DUE_AFTER_PROJECT',
    );
  }
}

export function listProjectTasks(ctx: ServiceContext, projectId: number): TaskSummary[] {
  requireProjectRow(ctx, projectId);
  return tasks.listProjectTasks(ctx.db, projectId);
}

export function getTask(ctx: ServiceContext, id: number): Task {
  const task = tasks.getTask(ctx.db, id);
  if (!task) throw taskNotFound();
  return task;
}

export function createTask(ctx: ServiceContext, projectId: number, input: unknown): Task {
  const data = taskCreateSchema.parse(input);
  return ctx.db.transaction(() => {
    const project = requireProjectRow(ctx, projectId);
    assertProjectWritable(project);
    const status: TaskStatus = data.status ?? 'da_fare';
    if (project.status === 'completato' && status !== 'fatto') throw completedProjectError();
    assertAssignee(ctx, data.assigneeId);
    assertDueWithinProject(project, data.dueDate);

    const now = nowIso(ctx.clock);
    const id = tasks.insertTask(
      ctx.db,
      projectId,
      {
        title: data.title,
        description: data.description ?? '',
        status,
        priority: data.priority ?? 'media',
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate ?? null,
        estimateHours: data.estimateHours ?? null,
        position: (tasks.maxPosition(ctx.db, projectId, status) ?? 0) + POSITION_STEP,
        completedAt: status === 'fatto' ? now : null,
      },
      now,
    );
    return getTask(ctx, id);
  });
}

function currentValues(row: tasks.TaskRow): tasks.TaskValues {
  return {
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    estimateHours: row.estimate_hours,
    position: row.position,
    completedAt: row.completed_at,
  };
}

export function updateTask(ctx: ServiceContext, id: number, input: unknown): Task {
  const data = taskUpdateSchema.parse(input);
  return ctx.db.transaction(() => {
    const row = requireTaskRow(ctx, id);
    const project = requireProjectRow(ctx, row.project_id);
    assertProjectWritable(project);
    if (row.version !== data.version) throw staleError('attività');

    const values = currentValues(row);
    if (data.title !== undefined) values.title = data.title;
    if (data.description !== undefined) values.description = data.description;
    if (data.priority !== undefined) values.priority = data.priority;
    if (data.assigneeId !== undefined) {
      if (data.assigneeId !== row.assignee_id) assertAssignee(ctx, data.assigneeId);
      values.assigneeId = data.assigneeId;
    }
    if (data.dueDate !== undefined) {
      if (data.dueDate !== row.due_date) assertDueWithinProject(project, data.dueDate);
      values.dueDate = data.dueDate;
    }
    if (data.estimateHours !== undefined) values.estimateHours = data.estimateHours;

    const now = nowIso(ctx.clock);
    if (data.status !== undefined && data.status !== row.status) {
      if (project.status === 'completato' && data.status !== 'fatto') throw completedProjectError();
      values.status = data.status;
      // A status change from the form puts the task at the bottom of the new column.
      values.position = (tasks.maxPosition(ctx.db, row.project_id, data.status) ?? 0) + POSITION_STEP;
      values.completedAt = data.status === 'fatto' ? now : null;
    }

    if (!tasks.updateTask(ctx.db, id, data.version, values, now)) throw staleError('attività');
    return getTask(ctx, id);
  });
}

export function deleteTask(ctx: ServiceContext, id: number): void {
  ctx.db.transaction(() => {
    const row = requireTaskRow(ctx, id);
    assertProjectWritable(requireProjectRow(ctx, row.project_id));
    tasks.deleteTask(ctx.db, id);
  });
}

/** Re-spaces a column evenly (excluding the task being moved). */
function renumberColumn(db: Database, projectId: number, status: TaskStatus, excludeId: number): void {
  tasks.columnTaskIds(db, projectId, status, excludeId).forEach((taskId, index) => {
    tasks.setTaskPosition(db, taskId, (index + 1) * POSITION_STEP);
  });
}

/**
 * Computes the new position for a task dropped in `status` right after `prevId`
 * (or right before `nextId` when it is dropped at the top). Anchoring to a neighbour
 * keeps the order correct even when the client shows a filtered subset of the column.
 */
function computePosition(
  db: Database,
  projectId: number,
  status: TaskStatus,
  selfId: number,
  prevId: number | null,
  nextId: number | null,
): { position: number; renumbered: boolean } {
  const neighbourPosition = (id: number): number => {
    const neighbour = tasks.findTaskRow(db, id);
    if (!neighbour || neighbour.project_id !== projectId || neighbour.status !== status || neighbour.id === selfId) {
      throw badRequest('La posizione indicata non è più valida: ricarica la pagina e riprova.');
    }
    return neighbour.position;
  };

  const attempt = (): number | null => {
    if (prevId !== null) {
      const prev = neighbourPosition(prevId);
      const after = db.get<{ p: number | null }>(
        'SELECT MIN(position) AS p FROM tasks WHERE project_id = ? AND status = ? AND id <> ? AND position > ?',
        [projectId, status, selfId, prev],
      )?.p;
      if (after === null || after === undefined) return prev + POSITION_STEP;
      return after - prev > MIN_POSITION_GAP * 2 ? (prev + after) / 2 : null;
    }
    if (nextId !== null) {
      const next = neighbourPosition(nextId);
      const before = db.get<{ p: number | null }>(
        'SELECT MAX(position) AS p FROM tasks WHERE project_id = ? AND status = ? AND id <> ? AND position < ?',
        [projectId, status, selfId, next],
      )?.p;
      if (before === null || before === undefined) return next - POSITION_STEP;
      return next - before > MIN_POSITION_GAP * 2 ? (before + next) / 2 : null;
    }
    const max = db.get<{ p: number | null }>(
      'SELECT MAX(position) AS p FROM tasks WHERE project_id = ? AND status = ? AND id <> ?',
      [projectId, status, selfId],
    )?.p;
    return (max ?? 0) + POSITION_STEP;
  };

  const position = attempt();
  if (position !== null) return { position, renumbered: false };
  renumberColumn(db, projectId, status, selfId);
  return { position: attempt()!, renumbered: true };
}

export function moveTask(ctx: ServiceContext, id: number, input: unknown): MoveTaskResult {
  const data = taskMoveSchema.parse(input);
  return ctx.db.transaction(() => {
    const row = requireTaskRow(ctx, id);
    const project = requireProjectRow(ctx, row.project_id);
    assertProjectWritable(project);
    if (project.status === 'completato' && data.status !== 'fatto') throw completedProjectError();

    const { position, renumbered } = computePosition(
      ctx.db,
      row.project_id,
      data.status,
      id,
      data.prevId ?? null,
      data.nextId ?? null,
    );
    const now = nowIso(ctx.clock);
    const values = currentValues(row);
    if (data.status !== row.status) values.completedAt = data.status === 'fatto' ? now : null;
    values.status = data.status;
    values.position = position;
    tasks.updateTask(ctx.db, id, null, values, now);
    return { task: tasks.getTaskSummary(ctx.db, id)!, renumbered };
  });
}
