import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { TaskWithProject } from '@gp/shared';
import { Avatar } from './ui/Avatar';
import { PriorityBadge } from './ui/Badges';
import { DueDateChip } from './ui/DueDate';

export const taskLink = (task: { id: number; projectId: number }) => `/progetti/${task.projectId}/kanban?attivita=${task.id}`;

/** Compact task row used by the dashboard and "Le mie attività". */
export function TaskRow({ task, showAssignee = true, extra }: { task: TaskWithProject; showAssignee?: boolean; extra?: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-5 py-3 @2xl:flex-row @2xl:items-center @2xl:gap-4">
      <div className="min-w-0 flex-1">
        <Link to={taskLink(task)} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">
          {task.title}
        </Link>
        <Link to={`/progetti/${task.projectId}/kanban`} className="block truncate text-xs text-slate-500 hover:text-slate-800 hover:underline">
          {task.projectName}
          {task.projectStatus === 'in_pausa' && ' · in pausa'}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 @2xl:flex-nowrap @2xl:justify-end">
        <PriorityBadge priority={task.priority} />
        <DueDateChip dueDate={task.dueDate} />
        {showAssignee && (
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <Avatar name={task.assigneeName} size="xs" decorative />
            <span className="max-w-28 truncate">{task.assigneeName ?? 'Non assegnata'}</span>
          </span>
        )}
        {extra}
      </div>
    </li>
  );
}
