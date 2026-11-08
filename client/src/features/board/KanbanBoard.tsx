import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Eye, Filter, MoreVertical, MoveRight, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TASK_STATUSES, TASK_STATUS_LABELS, type Project, type TaskStatus, type TaskSummary } from '@gp/shared';
import { useMoveTask } from '../../api/queries';
import { TASK_STATUS_STYLES } from '../../components/ui/Badges';
import { menuContentClass, menuItemClass } from '../../components/ui/Menu';
import { TaskCardBody } from './TaskCardBody';

type Columns = Record<TaskStatus, number[]>;
type MenuAction = { type: 'status'; status: TaskStatus } | { type: 'top' | 'bottom' | 'up' | 'down' };

const COLUMN_PREFIX = 'colonna:';
const PAGE_SIZE = 50;

/** Timestamp of the last drop, used to ignore the click that follows a drag. */
let lastDragEndedAt = 0;

function groupColumns(tasks: readonly TaskSummary[]): Columns {
  const columns: Columns = { da_fare: [], in_corso: [], in_revisione: [], fatto: [] };
  const sorted = [...tasks].sort((a, b) => a.position - b.position || a.id - b.id);
  for (const task of sorted) columns[task.status].push(task.id);
  return columns;
}

function focusCard(taskId: number) {
  window.setTimeout(() => document.querySelector<HTMLElement>(`[data-task-card="${taskId}"]`)?.focus(), 30);
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface CardProps {
  task: TaskSummary;
  readOnly: boolean;
  index: number;
  count: number;
  onOpen: (id: number) => void;
  onMenuMove: (id: number, action: MenuAction) => void;
}

function CardMenu({ task, index, count, onOpen, onMenuMove }: Omit<CardProps, 'readOnly'>) {
  const otherStatuses = TASK_STATUSES.filter((s) => s !== task.status);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Azioni per ${task.title}`}
          className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:text-slate-700 data-[state=open]:bg-slate-100"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={menuContentClass}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusCard(task.id);
          }}
        >
          <DropdownMenu.Item className={menuItemClass} onSelect={() => onOpen(task.id)}>
            <Eye className="size-4 text-slate-500" aria-hidden="true" /> Apri dettaglio
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Label className="px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Sposta in</DropdownMenu.Label>
          {otherStatuses.map((status) => (
            <DropdownMenu.Item key={status} className={menuItemClass} onSelect={() => onMenuMove(task.id, { type: 'status', status })}>
              <MoveRight className="size-4 text-slate-500" aria-hidden="true" /> {TASK_STATUS_LABELS[status]}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item className={menuItemClass} disabled={index === 0} onSelect={() => onMenuMove(task.id, { type: 'up' })}>
            <ArrowUp className="size-4 text-slate-500" aria-hidden="true" /> Sposta su
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} disabled={index >= count - 1} onSelect={() => onMenuMove(task.id, { type: 'down' })}>
            <ArrowDown className="size-4 text-slate-500" aria-hidden="true" /> Sposta giù
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} disabled={index === 0} onSelect={() => onMenuMove(task.id, { type: 'top' })}>
            <ArrowUpToLine className="size-4 text-slate-500" aria-hidden="true" /> In cima alla colonna
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} disabled={index >= count - 1} onSelect={() => onMenuMove(task.id, { type: 'bottom' })}>
            <ArrowDownToLine className="size-4 text-slate-500" aria-hidden="true" /> In fondo alla colonna
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const SortableTaskCard = memo(function SortableTaskCard({ task, readOnly, index, count, onOpen, onMenuMove }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: readOnly,
    attributes: { roleDescription: 'attività trascinabile' },
  });

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="relative">
      <div
        data-task-card={task.id}
        {...attributes}
        {...listeners}
        aria-disabled={undefined}
        aria-roledescription={readOnly ? undefined : attributes['aria-roledescription']}
        onClick={() => {
          if (Date.now() - lastDragEndedAt > 250) onOpen(task.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onOpen(task.id);
            return;
          }
          listeners?.onKeyDown?.(event);
        }}
        className={clsx(
          'rounded-xl border bg-white p-3 pr-9 shadow-xs transition-[border-color,box-shadow] select-none',
          'hover:border-slate-300 hover:shadow-sm',
          readOnly ? 'cursor-pointer' : 'cursor-grab touch-manipulation active:cursor-grabbing',
          task.priority === 'urgente' && task.status !== 'fatto' ? 'border-red-200' : 'border-slate-200',
          isDragging && 'opacity-40',
        )}
      >
        <TaskCardBody task={task} />
      </div>
      {!readOnly && <CardMenu task={task} index={index} count={count} onOpen={onOpen} onMenuMove={onMenuMove} />}
    </li>
  );
});

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

function KanbanColumn({
  status,
  ids,
  taskById,
  limit,
  readOnly,
  canCreate,
  onShowMore,
  onOpen,
  onMenuMove,
  onCreate,
}: {
  status: TaskStatus;
  ids: number[];
  taskById: Map<number, TaskSummary>;
  limit: number;
  readOnly: boolean;
  canCreate: boolean;
  onShowMore: () => void;
  onOpen: (id: number) => void;
  onMenuMove: (id: number, action: MenuAction) => void;
  onCreate: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}`, disabled: readOnly });
  const visible = ids.slice(0, limit);
  const hidden = ids.length - visible.length;
  const headingId = `colonna-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-[85vw] max-w-[22rem] shrink-0 snap-center flex-col rounded-2xl bg-slate-200/50 sm:w-72 lg:w-auto lg:max-w-none lg:min-w-[14rem] lg:flex-1"
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={clsx('size-2.5 rounded-full', TASK_STATUS_STYLES[status].dot)} aria-hidden="true" />
        <h2 id={headingId} className="text-sm font-semibold text-slate-800">
          {TASK_STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
          <span className="sr-only">Attività: </span>
          {ids.length}
        </span>
        {canCreate && (
          <button
            type="button"
            onClick={() => onCreate(status)}
            aria-label={`Aggiungi attività in ${TASK_STATUS_LABELS[status]}`}
            title={`Aggiungi attività in ${TASK_STATUS_LABELS[status]}`}
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        )}
      </header>
      <SortableContext items={visible} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={clsx('flex min-h-28 flex-1 flex-col gap-2 rounded-xl p-2 transition-colors', isOver && 'bg-brand-50/70 ring-2 ring-brand-200 ring-inset')}
        >
          {visible.map((id, index) => {
            const task = taskById.get(id);
            if (!task) return null;
            return (
              <SortableTaskCard
                key={id}
                task={task}
                readOnly={readOnly}
                index={index}
                count={ids.length}
                onOpen={onOpen}
                onMenuMove={onMenuMove}
              />
            );
          })}
          {ids.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-300/80 px-3 py-6 text-center text-xs text-slate-500">
              {readOnly ? 'Nessuna attività' : 'Nessuna attività. Trascina qui una scheda.'}
            </li>
          )}
        </ul>
      </SortableContext>
      {hidden > 0 && (
        <button
          type="button"
          onClick={onShowMore}
          className="mx-2 mb-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Mostra altre {Math.min(PAGE_SIZE, hidden)} <span className="text-slate-500">(ancora {hidden})</span>
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function KanbanBoard({
  project,
  tasks,
  readOnly,
  filtersActive,
  onOpenTask,
  onCreate,
}: {
  project: Project;
  tasks: TaskSummary[];
  readOnly: boolean;
  filtersActive: boolean;
  onOpenTask: (id: number) => void;
  onCreate: (status: TaskStatus) => void;
}) {
  const { mutate: moveTask } = useMoveTask(project.id);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const serverColumns = useMemo(() => groupColumns(tasks), [tasks]);
  const [columns, setColumns] = useState<Columns>(serverColumns);
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const snapshot = useRef<Columns | null>(null);
  const [limits, setLimits] = useState<Record<TaskStatus, number>>({ da_fare: PAGE_SIZE, in_corso: PAGE_SIZE, in_revisione: PAGE_SIZE, fatto: PAGE_SIZE });

  // Follow server/cache changes, but never in the middle of a drag.
  useEffect(() => {
    if (activeRef.current === null) setColumns(serverColumns);
  }, [serverColumns]);

  // Refs keep the card callbacks stable, so memoized cards do not re-render on every change.
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const serverColumnsRef = useRef(serverColumns);
  serverColumnsRef.current = serverColumns;
  const onOpenRef = useRef(onOpenTask);
  onOpenRef.current = onOpenTask;
  const handleOpen = useCallback((id: number) => onOpenRef.current(id), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const containerOf = useCallback((id: UniqueIdentifier, cols: Columns): TaskStatus | undefined => {
    if (typeof id === 'string' && id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length) as TaskStatus;
    return TASK_STATUSES.find((s) => cols[s].includes(Number(id)));
  }, []);

  const commit = useCallback(
    (taskId: number, cols: Columns) => {
      const status = containerOf(taskId, cols);
      if (!status) return;
      const items = cols[status];
      const index = items.indexOf(taskId);
      const prevId = items[index - 1] ?? null;
      const nextId = items[index + 1] ?? null;
      const original = serverColumnsRef.current[status];
      const originalIndex = original.indexOf(taskId);
      const unchanged =
        originalIndex >= 0 && (original[originalIndex - 1] ?? null) === prevId && (original[originalIndex + 1] ?? null) === nextId;
      if (unchanged) return;
      moveTask({ taskId, status, prevId, nextId });
    },
    [containerOf, moveTask],
  );

  const handleMenuMove = useCallback(
    (taskId: number, action: MenuAction) => {
      const cols = columnsRef.current;
      const status = containerOf(taskId, cols);
      if (!status) return;
      const items = cols[status];
      const index = items.indexOf(taskId);
      let next: Columns;
      switch (action.type) {
        case 'status':
          // Put it on top of the target column, so it stays visible.
          next = { ...cols, [status]: items.filter((id) => id !== taskId), [action.status]: [taskId, ...cols[action.status]] };
          break;
        case 'top':
          next = { ...cols, [status]: [taskId, ...items.filter((id) => id !== taskId)] };
          break;
        case 'bottom':
          next = { ...cols, [status]: [...items.filter((id) => id !== taskId), taskId] };
          break;
        case 'up':
          if (index <= 0) return;
          next = { ...cols, [status]: arrayMove(items, index, index - 1) };
          break;
        case 'down':
          if (index >= items.length - 1) return;
          next = { ...cols, [status]: arrayMove(items, index, index + 1) };
          break;
      }
      setColumns(next);
      commit(taskId, next);
      focusCard(taskId);
    },
    [commit, containerOf],
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    snapshot.current = columns;
    activeRef.current = Number(active.id);
    setActiveId(Number(active.id));
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setColumns((prev) => {
      const from = containerOf(active.id, prev);
      const to = containerOf(over.id, prev);
      if (!from || !to || from === to) return prev;
      const id = Number(active.id);
      const target = prev[to].filter((x) => x !== id);
      const overIndex = target.indexOf(Number(over.id));
      const index = overIndex >= 0 ? overIndex : Math.min(target.length, limits[to]);
      return { ...prev, [from]: prev[from].filter((x) => x !== id), [to]: [...target.slice(0, index), id, ...target.slice(index)] };
    });
  };

  const finishDrag = () => {
    lastDragEndedAt = Date.now();
    activeRef.current = null;
    setActiveId(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    finishDrag();
    const id = Number(active.id);
    const status = containerOf(id, columns);
    const overStatus = over ? containerOf(over.id, columns) : undefined;
    if (!over || !status || !overStatus) {
      if (snapshot.current) setColumns(snapshot.current);
      return;
    }
    let next = columns;
    if (status === overStatus && over.id !== active.id && !String(over.id).startsWith(COLUMN_PREFIX)) {
      const items = columns[status];
      const from = items.indexOf(id);
      const to = items.indexOf(Number(over.id));
      if (from >= 0 && to >= 0) next = { ...columns, [status]: arrayMove(items, from, to) };
    }
    setColumns(next);
    commit(id, next);
  };

  const handleDragCancel = () => {
    finishDrag();
    if (snapshot.current) setColumns(snapshot.current);
  };

  const titleOf = (id: UniqueIdentifier) => taskById.get(Number(id))?.title ?? 'attività';
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Hai preso l'attività «${titleOf(active.id)}».`,
    onDragOver: ({ active, over }) => {
      if (!over) return `L'attività «${titleOf(active.id)}» non è sopra una colonna.`;
      const status = containerOf(over.id, columnsRef.current);
      if (!status) return undefined;
      const position = columnsRef.current[status].indexOf(Number(active.id)) + 1;
      return `«${titleOf(active.id)}» è nella colonna ${TASK_STATUS_LABELS[status]}, posizione ${position} di ${columnsRef.current[status].length}.`;
    },
    onDragEnd: ({ active, over }) => {
      if (!over) return `Spostamento annullato.`;
      const status = containerOf(over.id, columnsRef.current);
      return status ? `Attività «${titleOf(active.id)}» rilasciata nella colonna ${TASK_STATUS_LABELS[status]}.` : undefined;
    },
    onDragCancel: ({ active }) => `Spostamento annullato. «${titleOf(active.id)}» è tornata alla posizione iniziale.`,
  };

  const activeTask = activeId !== null ? taskById.get(activeId) : undefined;
  const canCreate = !readOnly && project.status !== 'completato';

  return (
    <div>
      {filtersActive && !readOnly && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="size-3.5" aria-hidden="true" />
          Filtri attivi: le attività nascoste mantengono la loro posizione quando sposti le schede.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Premi Invio per aprire l'attività. Per spostarla premi la barra spaziatrice, usa le frecce per cambiare posizione o colonna, poi premi di nuovo la barra spaziatrice per rilasciarla oppure Esc per annullare.",
          },
        }}
      >
        <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:snap-none lg:px-0">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              ids={columns[status]}
              taskById={taskById}
              limit={limits[status]}
              readOnly={readOnly}
              canCreate={canCreate}
              onShowMore={() => setLimits((l) => ({ ...l, [status]: l[status] + PAGE_SIZE }))}
              onOpen={handleOpen}
              onMenuMove={handleMenuMove}
              onCreate={onCreate}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {activeTask ? (
            <div className="cursor-grabbing rounded-xl border border-brand-300 bg-white p-3 pr-9 shadow-xl ring-2 ring-brand-200">
              <TaskCardBody task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
