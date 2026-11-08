import { OPEN_TASK_STATUSES, addDays, type DashboardData, type OpenTaskStatus, type WorkloadRow } from '@gp/shared';
import { today as todayOf } from '../clock';
import { listMembers } from '../repositories/members';
import { listProjects } from '../repositories/projects';
import { countTasks, listTasksWithProject } from '../repositories/tasks';
import type { ServiceContext } from './context';

const LIST_LIMIT = 50;
/** Open tasks of non-archived projects. */
const OPEN_SCOPE = "t.status <> 'fatto' AND p.status <> 'archiviato'";

const emptyByStatus = (): Record<OpenTaskStatus, number> => ({ da_fare: 0, in_corso: 0, in_revisione: 0 });

export function getDashboard(ctx: ServiceContext): DashboardData {
  const today = todayOf(ctx.clock);
  const soonEnd = addDays(today, 7);

  const activeProjects = listProjects(ctx.db, today, ['attivo']).sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.name.localeCompare(b.name, 'it');
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  });

  const overdueWhere = `${OPEN_SCOPE} AND t.due_date < ?`;
  const dueSoonWhere = `${OPEN_SCOPE} AND t.due_date >= ? AND t.due_date <= ?`;

  const overdue = {
    total: countTasks(ctx.db, overdueWhere, [today]),
    items: listTasksWithProject(ctx.db, overdueWhere, [today], LIST_LIMIT),
  };
  const dueSoon = {
    total: countTasks(ctx.db, dueSoonWhere, [today, soonEnd]),
    items: listTasksWithProject(ctx.db, dueSoonWhere, [today, soonEnd], LIST_LIMIT),
  };

  const workloadRows = ctx.db.all<{ assignee_id: number | null; status: OpenTaskStatus; n: number; hours: number; overdue: number }>(
    `SELECT t.assignee_id, t.status, COUNT(*) AS n, COALESCE(SUM(t.estimate_hours), 0) AS hours,
       SUM(CASE WHEN t.due_date < :today THEN 1 ELSE 0 END) AS overdue
     FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE ${OPEN_SCOPE}
     GROUP BY t.assignee_id, t.status`,
    { today },
  );

  const rows = new Map<number | null, WorkloadRow>();
  for (const member of listMembers(ctx.db)) {
    rows.set(member.id, {
      memberId: member.id,
      name: member.name,
      role: member.role,
      byStatus: emptyByStatus(),
      openCount: 0,
      estimateHours: 0,
      overdueCount: 0,
    });
  }
  for (const r of workloadRows) {
    let row = rows.get(r.assignee_id);
    if (!row) {
      row = { memberId: null, name: 'Non assegnate', role: null, byStatus: emptyByStatus(), openCount: 0, estimateHours: 0, overdueCount: 0 };
      rows.set(r.assignee_id, row);
    }
    if ((OPEN_TASK_STATUSES as readonly string[]).includes(r.status)) row.byStatus[r.status] += r.n;
    row.openCount += r.n;
    row.estimateHours += r.hours;
    row.overdueCount += r.overdue;
  }

  const workload = [...rows.values()]
    .map((row) => ({ ...row, estimateHours: Math.round(row.estimateHours * 100) / 100 }))
    .sort((a, b) => {
      if (a.memberId === null) return 1;
      if (b.memberId === null) return -1;
      return b.openCount - a.openCount || a.name.localeCompare(b.name, 'it');
    });

  return {
    today,
    kpis: {
      activeProjects: activeProjects.length,
      openTasks: countTasks(ctx.db, OPEN_SCOPE, []),
      overdueTasks: overdue.total,
      dueSoonTasks: dueSoon.total,
    },
    activeProjects,
    overdue,
    dueSoon,
    workload,
  };
}
