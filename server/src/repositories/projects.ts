import {
  progressPercent,
  type ConflictingTasksDetails,
  type OpenTasksDetails,
  type Project,
  type ProjectStatus,
} from '@gp/shared';
import type { Database } from '../db/database';

/** Raw project columns, used for business-rule checks. */
export interface ProjectRow {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  due_date: string | null;
  owner_id: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface ProjectAggregateRow extends ProjectRow {
  owner_name: string;
  task_count: number;
  done_count: number;
  overdue_count: number;
}

const PROJECT_SELECT = `
  SELECT p.*, m.name AS owner_name,
    COUNT(t.id) AS task_count,
    COALESCE(SUM(CASE WHEN t.status = 'fatto' THEN 1 ELSE 0 END), 0) AS done_count,
    COALESCE(SUM(CASE WHEN t.status <> 'fatto' AND t.due_date < :today THEN 1 ELSE 0 END), 0) AS overdue_count
  FROM projects p
  JOIN members m ON m.id = p.owner_id
  LEFT JOIN tasks t ON t.project_id = p.id
`;

function mapProject(row: ProjectAggregateRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    dueDate: row.due_date,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskCount: row.task_count,
    doneCount: row.done_count,
    openCount: row.task_count - row.done_count,
    overdueCount: row.overdue_count,
    progress: progressPercent(row.done_count, row.task_count),
  };
}

export function findProjectRow(db: Database, id: number): ProjectRow | undefined {
  return db.get<ProjectRow>('SELECT * FROM projects WHERE id = ?', [id]);
}

export function getProject(db: Database, id: number, today: string): Project | undefined {
  const row = db.get<ProjectAggregateRow>(`${PROJECT_SELECT} WHERE p.id = :id GROUP BY p.id`, { id, today });
  return row ? mapProject(row) : undefined;
}

export function listProjects(db: Database, today: string, statuses?: readonly ProjectStatus[]): Project[] {
  if (statuses && statuses.length > 0) {
    const placeholders = statuses.map((_, i) => `:s${i}`).join(', ');
    const params: Record<string, string> = { today };
    statuses.forEach((s, i) => (params[`s${i}`] = s));
    return db
      .all<ProjectAggregateRow>(`${PROJECT_SELECT} WHERE p.status IN (${placeholders}) GROUP BY p.id`, params)
      .map(mapProject);
  }
  return db.all<ProjectAggregateRow>(`${PROJECT_SELECT} GROUP BY p.id`, { today }).map(mapProject);
}

export interface ProjectValues {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string | null;
  ownerId: number;
}

export function insertProject(db: Database, values: ProjectValues, now: string): number {
  return db.run(
    `INSERT INTO projects (name, description, status, start_date, due_date, owner_id, version, created_at, updated_at)
     VALUES (:name, :description, :status, :startDate, :dueDate, :ownerId, 1, :now, :now)`,
    { ...values, now },
  ).lastInsertRowid;
}

/** Full-row update guarded by optimistic version. Returns false when the version did not match. */
export function updateProject(db: Database, id: number, version: number, values: ProjectValues, now: string): boolean {
  const result = db.run(
    `UPDATE projects SET name = :name, description = :description, status = :status, start_date = :startDate,
       due_date = :dueDate, owner_id = :ownerId, version = version + 1, updated_at = :now
     WHERE id = :id AND version = :version`,
    { ...values, id, version, now },
  );
  return result.changes === 1;
}

export function deleteProject(db: Database, id: number): void {
  db.run('DELETE FROM projects WHERE id = ?', [id]);
}

export function openTasksDetails(db: Database, projectId: number, limit = 20): OpenTasksDetails {
  const counts = db.all<{ status: 'da_fare' | 'in_corso' | 'in_revisione'; n: number }>(
    `SELECT status, COUNT(*) AS n FROM tasks WHERE project_id = ? AND status <> 'fatto' GROUP BY status`,
    [projectId],
  );
  const byStatus = { da_fare: 0, in_corso: 0, in_revisione: 0 };
  for (const c of counts) byStatus[c.status] = c.n;
  const tasks = db.all<{ id: number; title: string; status: 'da_fare' | 'in_corso' | 'in_revisione' }>(
    `SELECT id, title, status FROM tasks WHERE project_id = ? AND status <> 'fatto'
     ORDER BY CASE status WHEN 'in_revisione' THEN 0 WHEN 'in_corso' THEN 1 ELSE 2 END, position LIMIT ?`,
    [projectId, limit],
  );
  return {
    openCount: byStatus.da_fare + byStatus.in_corso + byStatus.in_revisione,
    byStatus,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
  };
}

export function tasksDueAfter(db: Database, projectId: number, date: string, limit = 20): ConflictingTasksDetails {
  const count =
    db.get<{ n: number }>('SELECT COUNT(*) AS n FROM tasks WHERE project_id = ? AND due_date > ?', [projectId, date])?.n ?? 0;
  const tasks = db.all<{ id: number; title: string; due_date: string }>(
    'SELECT id, title, due_date FROM tasks WHERE project_id = ? AND due_date > ? ORDER BY due_date DESC LIMIT ?',
    [projectId, date, limit],
  );
  return { count, tasks: tasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })) };
}

export function ownedProjects(db: Database, memberId: number): { id: number; name: string; status: ProjectStatus }[] {
  return db.all<{ id: number; name: string; status: ProjectStatus }>(
    'SELECT id, name, status FROM projects WHERE owner_id = ? ORDER BY name COLLATE NOCASE',
    [memberId],
  ).map((r) => ({ id: r.id, name: r.name, status: r.status }));
}
