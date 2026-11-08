import { Clock, MessageSquare } from 'lucide-react';
import { formatHours, type TaskSummary } from '@gp/shared';
import { Avatar } from '../../components/ui/Avatar';
import { PriorityBadge } from '../../components/ui/Badges';
import { DueDateChip } from '../../components/ui/DueDate';

/** Visual content of a kanban card (shared by the card and the drag overlay). */
export function TaskCardBody({ task }: { task: TaskSummary }) {
  const done = task.status === 'fatto';
  return (
    <>
      <p className={done ? 'text-sm font-medium break-words text-slate-500 line-through decoration-slate-300' : 'text-sm font-medium break-words text-slate-900'}>
        {task.title}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <DueDateChip dueDate={task.dueDate} done={done} />
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-500">
        {task.estimateHours !== null && (
          <span className="inline-flex items-center gap-1" title="Stima">
            <Clock className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Stima: </span>
            {formatHours(task.estimateHours)}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1" title="Commenti">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Commenti: </span>
            {task.commentCount}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="sr-only">Assegnatario: {task.assigneeName ?? 'nessuno'}</span>
          <Avatar name={task.assigneeName} size="xs" decorative />
        </span>
      </div>
    </>
  );
}
