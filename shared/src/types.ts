import type { OpenTaskStatus, ProjectStatus, TaskPriority, TaskStatus } from './enums';

export interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberWithStats extends Member {
  /** Open tasks assigned to the member in non-archived projects. */
  openTaskCount: number;
  ownedProjectCount: number;
}

export interface MemberImpact {
  member: Member;
  assignedTaskCount: number;
  openTaskCount: number;
  commentCount: number;
  ownedProjects: { id: number; name: string; status: ProjectStatus }[];
}

export interface Project {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string | null;
  ownerId: number;
  ownerName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  doneCount: number;
  openCount: number;
  overdueCount: number;
  /** 0-100, done tasks over total tasks. */
  progress: number;
}

export interface ProjectListResponse {
  items: Project[];
  /** Counts per status after the text search, before the status filter (for filter chips). */
  statusCounts: Record<ProjectStatus, number>;
  total: number;
}

export interface TaskSummary {
  id: number;
  projectId: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  position: number;
  commentCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Task extends TaskSummary {
  description: string;
  project: { id: number; name: string; status: ProjectStatus; dueDate: string | null };
}

/** Task with the owning project's name, used by cross-project views. */
export interface TaskWithProject extends TaskSummary {
  projectName: string;
  projectStatus: ProjectStatus;
}

export interface MoveTaskResult {
  task: TaskSummary;
  /** True when the column positions were renumbered (clients should refetch the order). */
  renumbered: boolean;
}

export interface Comment {
  id: number;
  taskId: number;
  authorId: number | null;
  authorName: string;
  /** True when the author has been deleted (name kept from the comment snapshot). */
  authorDeleted: boolean;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkloadRow {
  /** null = unassigned tasks */
  memberId: number | null;
  name: string;
  role: string | null;
  byStatus: Record<OpenTaskStatus, number>;
  openCount: number;
  estimateHours: number;
  overdueCount: number;
}

export interface DashboardData {
  today: string;
  kpis: {
    activeProjects: number;
    openTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
  };
  activeProjects: Project[];
  overdue: { total: number; items: TaskWithProject[] };
  dueSoon: { total: number; items: TaskWithProject[] };
  workload: WorkloadRow[];
}

export interface EntityCounts {
  members: number;
  projects: number;
  tasks: number;
  comments: number;
}

export interface BackupValidationReport {
  valid: boolean;
  errors: { path: string; message: string }[];
  /** True when more errors exist than those listed. */
  truncated: boolean;
  file: { exportedAt: string | null; formatVersion: number | null; counts: EntityCounts | null };
  current: EntityCounts;
}

export interface RestoreResult {
  restored: EntityCounts;
  /** File name of the safety snapshot taken before restoring, if any. */
  snapshot: string | null;
}
