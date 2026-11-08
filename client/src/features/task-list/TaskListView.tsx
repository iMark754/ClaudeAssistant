import { useWindowVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, ListTodo, MessageSquare, Plus, SearchX } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatHours, isTaskSortKey, sortTasks, type SortDirection, type TaskSortKey, type TaskSummary } from '@gp/shared';
import { Avatar } from '../../components/ui/Avatar';
import { PriorityBadge, TaskStatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { DueDateChip } from '../../components/ui/DueDate';
import { EmptyState } from '../../components/ui/Feedback';

const ROW_HEIGHT = 53;

const COLUMNS: { key: TaskSortKey; label: string; className?: string }[] = [
  { key: 'title', label: 'Attività', className: 'w-[33%]' },
  { key: 'status', label: 'Stato', className: 'w-[13%]' },
  { key: 'priority', label: 'Priorità', className: 'w-[11%]' },
  { key: 'assignee', label: 'Assegnatario', className: 'w-[18%]' },
  { key: 'dueDate', label: 'Scadenza', className: 'w-[16%]' },
  { key: 'estimate', label: 'Stima', className: 'w-[9%] text-right' },
];

export function TaskListView({
  tasks,
  totalCount,
  onOpenTask,
  onCreate,
  onResetFilters,
}: {
  tasks: TaskSummary[];
  totalCount: number;
  onOpenTask: (id: number) => void;
  onCreate?: () => void;
  onResetFilters: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const sortKey: TaskSortKey = isTaskSortKey(params.get('ordina')) ? (params.get('ordina') as TaskSortKey) : 'position';
  const direction: SortDirection = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const rows = useMemo(() => sortTasks(tasks, sortKey, direction), [tasks, sortKey, direction]);

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const update = () => setScrollMargin((listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rows.length]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    scrollMargin,
  });

  const setSort = (key: TaskSortKey) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (sortKey === key && direction === 'asc') {
          next.set('ordina', key);
          next.set('dir', 'desc');
        } else if (sortKey === key && direction === 'desc') {
          next.delete('ordina');
          next.delete('dir');
        } else {
          next.set('ordina', key);
          next.delete('dir');
        }
        return next;
      },
      { replace: true },
    );
  };

  if (totalCount === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="Nessuna attività in questo progetto"
        description="Aggiungi la prima attività per iniziare."
        action={
          onCreate && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={onCreate}>
              Nuova attività
            </Button>
          )
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nessuna attività corrisponde ai filtri"
        description="Modifica i filtri per vedere altre attività."
        action={<Button onClick={onResetFilters}>Azzera filtri</Button>}
      />
    );
  }

  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length > 0 ? items[0]!.start - scrollMargin : 0;
  const paddingBottom = items.length > 0 ? virtualizer.getTotalSize() - (items[items.length - 1]!.end - scrollMargin) : 0;

  return (
    <div ref={listRef} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full min-w-[780px] table-fixed text-sm" aria-rowcount={rows.length + 1}>
        <caption className="sr-only">
          Attività del progetto, {rows.length} righe. Ordinate per {COLUMNS.find((c) => c.key === sortKey)?.label.toLowerCase() ?? 'posizione nella bacheca'}.
        </caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr aria-rowindex={1}>
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={clsx('px-3 py-2.5 first:pl-5', column.className)}
                >
                  <button
                    type="button"
                    onClick={() => setSort(column.key)}
                    className={clsx(
                      'inline-flex items-center gap-1 rounded uppercase hover:text-slate-900',
                      active && 'text-slate-900',
                      column.className?.includes('text-right') && 'flex-row-reverse',
                    )}
                  >
                    {column.label}
                    <Icon className={clsx('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={COLUMNS.length} style={{ height: paddingTop, padding: 0 }} />
            </tr>
          )}
          {items.map((item) => {
            const task = rows[item.index]!;
            const done = task.status === 'fatto';
            return (
              <tr
                key={task.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                aria-rowindex={item.index + 2}
                onClick={() => onOpenTask(task.id)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2.5 pl-5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTask(task.id);
                      }}
                      className={clsx(
                        'min-w-0 truncate text-left font-medium hover:underline',
                        done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900',
                      )}
                    >
                      {task.title}
                    </button>
                    {task.commentCount > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-slate-400" title={`${task.commentCount} commenti`}>
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Commenti: </span>
                        {task.commentCount}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <TaskStatusBadge status={task.status} />
                </td>
                <td className="px-3 py-2.5">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={task.assigneeName} size="xs" decorative />
                    <span className={clsx('truncate', task.assigneeName ? 'text-slate-700' : 'text-slate-400 italic')}>
                      {task.assigneeName ?? 'Non assegnata'}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5">{task.dueDate ? <DueDateChip dueDate={task.dueDate} done={done} /> : <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {task.estimateHours !== null ? formatHours(task.estimateHours) : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={COLUMNS.length} style={{ height: paddingBottom, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
