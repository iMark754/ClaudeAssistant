import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  BackupValidationReport,
  Comment,
  DashboardData,
  Member,
  MemberImpact,
  MemberWithStats,
  MoveTaskResult,
  Project,
  ProjectListResponse,
  RestoreResult,
  Task,
  TaskSummary,
  TaskWithProject,
} from '@gp/shared';
import { applyOptimisticMove, type MoveRequest } from '../lib/positions';
import { api, errorMessage } from './client';

export const queryKeys = {
  members: ['members'] as const,
  memberImpact: (id: number) => ['members', id, 'impact'] as const,
  projectList: (params: ProjectListParams) => ['projects', 'list', params] as const,
  project: (id: number) => ['projects', 'detail', id] as const,
  projectTasks: (id: number) => ['projects', 'tasks', id] as const,
  task: (id: number) => ['tasks', id] as const,
  comments: (taskId: number) => ['tasks', taskId, 'comments'] as const,
  dashboard: ['dashboard'] as const,
  myTasks: (memberId: number) => ['my-tasks', memberId] as const,
};

/** Anything derived from projects/tasks (lists, counters, dashboard) becomes stale together. */
function invalidateWorkData(qc: QueryClient, options: { exceptProjectTasks?: number } = {}) {
  void qc.invalidateQueries({
    predicate: (query) => {
      const [root, kind, id] = query.queryKey as [string, unknown?, unknown?];
      if (options.exceptProjectTasks !== undefined && root === 'projects' && kind === 'tasks' && id === options.exceptProjectTasks) {
        return false;
      }
      return ['projects', 'tasks', 'dashboard', 'my-tasks', 'members'].includes(root);
    },
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface ProjectListParams {
  q: string;
  status: string;
  sort: string;
  dir: string;
}

export const useMembers = () =>
  useQuery({ queryKey: queryKeys.members, queryFn: () => api.get<MemberWithStats[]>('/members') });

export const useMemberImpact = (id: number | null) =>
  useQuery({
    queryKey: queryKeys.memberImpact(id ?? 0),
    queryFn: () => api.get<MemberImpact>(`/members/${id}/impact`),
    enabled: id !== null,
    staleTime: 0,
  });

export const useProjects = (params: ProjectListParams) =>
  useQuery({
    queryKey: queryKeys.projectList(params),
    queryFn: () => api.get<ProjectListResponse>(`/projects?${new URLSearchParams({ ...params }).toString()}`),
    placeholderData: keepPreviousData,
  });

export const useProject = (id: number) =>
  useQuery({ queryKey: queryKeys.project(id), queryFn: () => api.get<Project>(`/projects/${id}`) });

export const useProjectTasks = (id: number) =>
  useQuery({ queryKey: queryKeys.projectTasks(id), queryFn: () => api.get<TaskSummary[]>(`/projects/${id}/tasks`) });

export const useTask = (id: number | null) =>
  useQuery({
    queryKey: queryKeys.task(id ?? 0),
    queryFn: () => api.get<Task>(`/tasks/${id}`),
    enabled: id !== null,
  });

export const useComments = (taskId: number | null) =>
  useQuery({
    queryKey: queryKeys.comments(taskId ?? 0),
    queryFn: () => api.get<Comment[]>(`/tasks/${taskId}/comments`),
    enabled: taskId !== null,
  });

export const useDashboard = () =>
  useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.get<DashboardData>('/dashboard') });

export const useMyTasks = (memberId: number | null) =>
  useQuery({
    queryKey: queryKeys.myTasks(memberId ?? 0),
    queryFn: () => api.get<TaskWithProject[]>(`/members/${memberId}/open-tasks`),
    enabled: memberId !== null,
  });

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; role: string }) => api.post<Member>('/members', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.members }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; email?: string; role?: string }) =>
      api.patch<Member>(`/members/${id}`, input),
    onSuccess: () => invalidateWorkData(qc),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignOwnerTo }: { id: number; reassignOwnerTo?: number }) =>
      api.delete(`/members/${id}${reassignOwnerTo ? `?reassignOwnerTo=${reassignOwnerTo}` : ''}`),
    onSuccess: () => invalidateWorkData(qc),
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) => api.post<Project>('/projects', input),
    onSuccess: () => invalidateWorkData(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; version: number } & Record<string, unknown>) =>
      api.patch<Project>(`/projects/${id}`, input),
    onSuccess: (project) => {
      qc.setQueryData(queryKeys.project(project.id), project);
      invalidateWorkData(qc);
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.project(id) });
      qc.removeQueries({ queryKey: queryKeys.projectTasks(id) });
      invalidateWorkData(qc);
    },
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function useCreateTask(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) => api.post<Task>(`/projects/${projectId}/tasks`, input),
    onSuccess: () => invalidateWorkData(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; version: number } & Record<string, unknown>) =>
      api.patch<Task>(`/tasks/${id}`, input),
    onSuccess: (task) => {
      qc.setQueryData(queryKeys.task(task.id), task);
      invalidateWorkData(qc);
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/tasks/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.task(id) });
      invalidateWorkData(qc);
    },
  });
}

/** Kanban move with optimistic update and rollback. */
export function useMoveTask(projectId: number) {
  const qc = useQueryClient();
  const key = queryKeys.projectTasks(projectId);
  return useMutation({
    mutationFn: ({ taskId, ...body }: MoveRequest) => api.post<MoveTaskResult>(`/tasks/${taskId}/move`, body),
    onMutate: async (move) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TaskSummary[]>(key);
      if (previous) qc.setQueryData(key, applyOptimisticMove(previous, move));
      return { previous };
    },
    onError: (error, _move, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error(errorMessage(error));
    },
    onSuccess: (result) => {
      qc.setQueryData<TaskSummary[]>(key, (old) => old?.map((t) => (t.id === result.task.id ? result.task : t)));
      if (result.renumbered) void qc.invalidateQueries({ queryKey: key });
    },
    onSettled: (_data, _error, move) => {
      void qc.invalidateQueries({ queryKey: queryKeys.task(move.taskId) });
      invalidateWorkData(qc, { exceptProjectTasks: projectId });
    },
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useCreateComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; authorId: number }) => api.post<Comment>(`/tasks/${taskId}/comments`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.comments(taskId) });
      invalidateWorkData(qc);
    },
  });
}

export function useUpdateComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.patch<Comment>(`/comments/${id}`, { body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.comments(taskId) }),
  });
}

export function useDeleteComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/comments/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.comments(taskId) });
      invalidateWorkData(qc);
    },
  });
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const useValidateBackup = () =>
  useMutation({ mutationFn: (payload: unknown) => api.post<BackupValidationReport>('/backup/validate', payload) });

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => api.post<RestoreResult>('/backup/restore', payload),
    // Everything changed: drop cached data and refetch what is on screen.
    onSuccess: () => void qc.resetQueries(),
  });
}
