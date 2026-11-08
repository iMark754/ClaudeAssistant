import type { ProjectStatus, Task, TaskPriority, TaskStatus, TaskSummary, TaskWithProject } from '@gp/shared';
import type { Database } from '../db/database';

export interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: number | null;
  due_date: string | null;
  estimate_hours: number | null;
  position: number;
  completed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface TaskSummaryRow extends Omit<TaskRow, 'description'> {
  assignee_name: string | null;
  comment_count: number;
}

interface TaskDetailRow extends TaskSummaryRow {
  description: string;
  project_name: string;
  project_status: ProjectStatus;
  project_due_date: string | null;
}

interface TaskWithProjectRow extends TaskSummaryRow {
  project_name: string;
  project_status: ProjectStatus;
}

const SUMMARY_COLUMNS = `
  t.id, t.project_id, t.title, t.status, t.priority, t.assignee_id, m.name AS assignee_name,
  t.due_date, t.estimate_hours, t.position, t.completed_at, t.version, t.created_at, t.updated_at,
  (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
`;

export const TASK_WITH_PROJECT_SELECT = `
  SELECT ${SUMMARY_COLUMNS}, p.name AS project_name, p.status AS project_status
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN members m ON m.id = t.assignee_id
`;

/** Orders by due date (empty last), then priority (most urgent first), then board position. */
export const DUE_PRIORITY_ORDER = `
  ORDER BY t.due_date IS NULL, t.due_date,
    CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
    t.position, t.id
`;

export function mapTaskSummary(row: TaskSummaryRow): TaskSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    dueDate: row.due_date,
    estimateHours: row.estimate_hours,
    position: row.position,
    commentCount: row.comment_count,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function mapTaskWithProject(row: TaskWithProjectRow): TaskWithProject {
  return { ...mapTaskSummary(row), projectName: row.project_name, projectStatus: row.project_status };
}

export function findTaskRow(db: Database, id: number): TaskRow | undefined {
  return db.get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
}

export function getTaskSummary(db: Database, id: number): TaskSummary | undefined {
  const row = db.get<TaskSummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM tasks t LEFT JOIN members m ON m.id = t.assignee_id WHERE t.id = ?`,
    [id],
  );
  return row ? mapTaskSummary(row) : undefined;
}

export function getTask(db: Database, id: number): Task | undefined {
  const row = db.get<TaskDetailRow>(
    `SELECT ${SUMMARY_COLUMNS}, t.description, p.name AS project_name, p.status AS project_status, p.due_date AS project_due_date
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN members m ON m.id = t.assignee_id
     WHERE t.id = ?`,
    [id],
  );
  if (!row) return undefined;
  return {
    ...mapTaskSummary(row),
    description: row.description,
    project: { id: row.project_id, name: row.project_name, status: row.project_status, dueDate: row.project_due_date },
  };
}

export function listProjectTasks(db: Database, projectId: number): TaskSummary[] {
  return db
    .all<TaskSummaryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM tasks t LEFT JOIN members m ON m.id = t.assignee_id
       WHERE t.project_id = ? ORDER BY t.position, t.id`,
      [projectId],
    )
    .map(mapTaskSummary);
}

/** Full task rows of a project, including descriptions (for CSV export). */
export function listProjectTasksWithDescription(db: Database, projectId: number): (TaskSummary & { description: string; assigneeEmail: string | null })[] {
  return db
    .all<TaskSummaryRow & { description: string; assignee_email: string | null }>(
      `SELECT ${SUMMARY_COLUMNS}, t.description, m.email AS assignee_email
       FROM tasks t LEFT JOIN members m ON m.id = t.assignee_id
       WHERE t.project_id = ? ORDER BY t.position, t.id`,
      [projectId],
    )
    .map((row) => ({ ...mapTaskSummary(row), description: row.description, assigneeEmail: row.assignee_email }));
}

export interface TaskValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: number | null;
  dueDate: string | null;
  estimateHours: number | null;
  position: number;
  completedAt: string | null;
}

export function insertTask(db: Database, projectId: number, values: TaskValues, now: string): number {
  return db.run(
    `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, estimate_hours,
       position, completed_at, version, created_at, updated_at)
     VALUES (:projectId, :title, :description, :status, :priority, :assigneeId, :dueDate, :estimateHours,
       :position, :completedAt, 1, :now, :now)`,
    { projectId, ...values, now },
  ).lastInsertRowid;
}

/** Full-row update. When `version` is given, the update only happens if it matches. */
export function updateTask(db: Database, id: number, version: number | null, values: TaskValues, now: string): boolean {
  const result = db.run(
    `UPDATE tasks SET title = :title, description = :description, status = :status, priority = :priority,
       assignee_id = :assigneeId, due_date = :dueDate, estimate_hours = :estimateHours, position = :position,
       completed_at = :completedAt, version = version + 1, updated_at = :now
     WHERE id = :id AND (:version IS NULL OR version = :version)`,
    { ...values, id, version, now },
  );
  return result.changes === 1;
}

export function deleteTask(db: Database, id: number): void {
  db.run('DELETE FROM tasks WHERE id = ?', [id]);
}

export function maxPosition(db: Database, projectId: number, status: TaskStatus): number | null {
  return (
    db.get<{ p: number | null }>('SELECT MAX(position) AS p FROM tasks WHERE project_id = ? AND status = ?', [projectId, status])?.p ??
    null
  );
}

export function minPosition(db: Database, projectId: number, status: TaskStatus): number | null {
  return (
    db.get<{ p: number | null }>('SELECT MIN(position) AS p FROM tasks WHERE project_id = ? AND status = ?', [projectId, status])?.p ??
    null
  );
}

export function columnTaskIds(db: Database, projectId: number, status: TaskStatus, excludeId: number): number[] {
  return db
    .all<{ id: number }>('SELECT id FROM tasks WHERE project_id = ? AND status = ? AND id <> ? ORDER BY position, id', [
      projectId,
      status,
      excludeId,
    ])
    .map((r) => r.id);
}

export function setTaskPosition(db: Database, id: number, position: number): void {
  db.run('UPDATE tasks SET position = ? WHERE id = ?', [position, id]);
}

export function countTasks(db: Database, where: string, params: (string | number)[]): number {
  return db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM tasks t JOIN projects p ON p.id = t.project_id WHERE ${where}`, params)?.n ?? 0;
}

export function listTasksWithProject(db: Database, where: string, params: (string | number)[], limit?: number): TaskWithProject[] {
  const limitClause = limit ? ` LIMIT ${Math.floor(limit)}` : '';
  return db
    .all<TaskWithProjectRow>(`${TASK_WITH_PROJECT_SELECT} WHERE ${where} ${DUE_PRIORITY_ORDER}${limitClause}`, params)
    .map(mapTaskWithProject);
}
