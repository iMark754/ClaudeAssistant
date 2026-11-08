import { Archive, SearchX, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { formatDateTime, type Task } from '@gp/shared';
import { errorMessage, isApiError } from '../../api/client';
import { useDeleteTask, useMembers, useTask, useUpdateTask } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, Drawer } from '../../components/ui/Dialog';
import { Callout, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { handleFormError, type FieldErrors } from '../../lib/forms';
import { Comments } from './Comments';
import { TaskFields, parseTaskForm, sameFormValues, toFormValues, type ParsedTask, type TaskFormValues } from './TaskFields';

function changedFields(task: Task, data: ParsedTask): Partial<ParsedTask> {
  const changes: Partial<ParsedTask> = {};
  (Object.keys(data) as (keyof ParsedTask)[]).forEach((key) => {
    if (data[key] !== task[key]) (changes as Record<string, unknown>)[key] = data[key];
  });
  return changes;
}

function TaskDetailContent({
  task,
  onDirtyChange,
  onDeleted,
  onReload,
}: {
  task: Task;
  onDirtyChange: (dirty: boolean) => void;
  onDeleted: () => void;
  onReload: () => Promise<Task | undefined>;
}) {
  const formId = useId();
  const { data: members } = useMembers();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const readOnly = task.project.status === 'archiviato';
  const [values, setValues] = useState<TaskFormValues>(() => toFormValues(task));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pristine = toFormValues(task);
  const dirty = !sameFormValues(values, pristine);
  const baseRef = useRef(pristine);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // A newer version arrived (our own save or someone else's change):
  // show it, unless the user has unsaved edits based on the previous version.
  useEffect(() => {
    const previousBase = baseRef.current;
    baseRef.current = toFormValues(task);
    setValues((current) => (sameFormValues(current, previousBase) ? toFormValues(task) : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.version]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = parseTaskForm(values, task.project.dueDate);
    if (result.errors) return setErrors(result.errors);
    const changes = changedFields(task, result.data);
    if (Object.keys(changes).length === 0) return;
    update.mutate(
      { id: task.id, version: task.version, ...changes },
      {
        onSuccess: (saved) => {
          setValues(toFormValues(saved));
          toast.success('Attività aggiornata');
        },
        onError: (error) => {
          if (isApiError(error, 'STALE_VERSION')) {
            toast.error(error.message, {
              action: {
                label: 'Ricarica',
                onClick: () => {
                  void onReload().then((fresh) => {
                    if (!fresh) return;
                    baseRef.current = toFormValues(fresh);
                    setValues(toFormValues(fresh));
                    setErrors({});
                  });
                },
              },
            });
            return;
          }
          handleFormError(error, setErrors);
        },
      },
    );
  };

  return (
    <div className="space-y-6 p-5">
      {readOnly && (
        <Callout tone="warning" icon={Archive}>
          Il progetto è archiviato: l’attività è in sola lettura.
        </Callout>
      )}
      {task.project.status === 'completato' && (
        <Callout tone="info">Il progetto è completato: lo stato delle attività non può tornare indietro finché il progetto non viene riaperto.</Callout>
      )}

      <form id={formId} onSubmit={onSubmit} noValidate>
        <TaskFields
          values={values}
          errors={errors}
          onChange={(next, field) => {
            setValues(next);
            setErrors((e) => ({ ...e, [field]: '' }));
          }}
          members={members ?? []}
          projectDueDate={task.project.dueDate}
          disabled={readOnly}
        />
      </form>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3">
          <Button variant="danger-ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
            Elimina attività
          </Button>
          <div className="flex gap-2">
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setValues(pristine);
                  setErrors({});
                }}
              >
                Annulla modifiche
              </Button>
            )}
            <Button type="submit" form={formId} size="sm" variant="primary" disabled={!dirty} loading={update.isPending}>
              Salva modifiche
            </Button>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
        <div>
          <dt className="inline">Creata il </dt>
          <dd className="inline text-slate-700">{formatDateTime(task.createdAt)}</dd>
        </div>
        <div>
          <dt className="inline">Ultima modifica </dt>
          <dd className="inline text-slate-700">{formatDateTime(task.updatedAt)}</dd>
        </div>
        {task.completedAt && (
          <div>
            <dt className="inline">Completata il </dt>
            <dd className="inline text-slate-700">{formatDateTime(task.completedAt)}</dd>
          </div>
        )}
      </dl>

      <Comments taskId={task.id} readOnly={readOnly} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminare l’attività?"
        description={`«${task.title}» e i suoi commenti verranno eliminati definitivamente.`}
        confirmLabel="Elimina attività"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(task.id, {
            onSuccess: () => {
              toast.success('Attività eliminata');
              onDeleted();
            },
            onError: (error) => {
              setConfirmDelete(false);
              toast.error(errorMessage(error));
            },
          })
        }
      />
    </div>
  );
}

/** Side panel with the task details and comments, opened via `?attivita=ID`. */
export function TaskDetailDrawer({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const { data: task, isLoading, isError, error, refetch } = useTask(taskId);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  return (
    <>
      <Drawer
        open
        onOpenChange={(open) => !open && requestClose()}
        title={task?.title ?? (isLoading ? 'Caricamento…' : 'Attività')}
        description={task ? `${task.project.name} · #${task.id}` : undefined}
      >
        {isLoading && (
          <div className="space-y-4 p-5" role="status">
            <span className="sr-only">Caricamento dell’attività…</span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        )}
        {isError &&
          (isApiError(error, 'NOT_FOUND') ? (
            <div className="p-5">
              <EmptyState icon={SearchX} title="Attività non trovata" description="Potrebbe essere stata eliminata." />
            </div>
          ) : (
            <div className="p-5">
              <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
            </div>
          ))}
        {task && (
          <TaskDetailContent
            key={task.id}
            task={task}
            onDirtyChange={setDirty}
            onDeleted={onClose}
            onReload={() => refetch().then((result) => result.data)}
          />
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Modifiche non salvate"
        description="Hai modificato l’attività senza salvare. Vuoi chiudere comunque e perdere le modifiche?"
        confirmLabel="Chiudi senza salvare"
        cancelLabel="Continua a modificare"
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
      />
    </>
  );
}
