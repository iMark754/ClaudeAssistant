import type { TaskStatus, TaskSummary } from '@gp/shared';

export const POSITION_STEP = 1024;

export interface MoveRequest {
  taskId: number;
  status: TaskStatus;
  prevId: number | null;
  nextId: number | null;
}

/**
 * Mirrors the server positioning logic to update the cache optimistically:
 * the task is placed right after `prevId` (or right before `nextId`), otherwise at the bottom.
 */
export function applyOptimisticMove(tasks: readonly TaskSummary[], move: MoveRequest): TaskSummary[] {
  const self = tasks.find((t) => t.id === move.taskId);
  if (!self) return [...tasks];
  const column = tasks
    .filter((t) => t.projectId === self.projectId && t.status === move.status && t.id !== move.taskId)
    .map((t) => t.position);

  let position: number;
  const prev = move.prevId !== null ? tasks.find((t) => t.id === move.prevId) : undefined;
  const next = move.nextId !== null ? tasks.find((t) => t.id === move.nextId) : undefined;
  if (prev) {
    const after = column.filter((p) => p > prev.position);
    position = after.length > 0 ? (prev.position + Math.min(...after)) / 2 : prev.position + POSITION_STEP;
  } else if (next) {
    const before = column.filter((p) => p < next.position);
    position = before.length > 0 ? (Math.max(...before) + next.position) / 2 : next.position - POSITION_STEP;
  } else {
    position = (column.length > 0 ? Math.max(...column) : 0) + POSITION_STEP;
  }

  const statusChanged = self.status !== move.status;
  return tasks.map((t) =>
    t.id === move.taskId
      ? {
          ...t,
          status: move.status,
          position,
          completedAt: statusChanged ? (move.status === 'fatto' ? new Date().toISOString() : null) : t.completedAt,
        }
      : t,
  );
}
