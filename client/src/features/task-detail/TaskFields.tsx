import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  formatDate,
  taskCreateSchema,
  taskDueDateError,
  type MemberWithStats,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@gp/shared';
import { Field, Select, TextArea, TextInput } from '../../components/ui/Form';
import { validate, type FieldErrors } from '../../lib/forms';

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  estimateHours: string;
}

const hoursFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: false });

export function toFormValues(task?: Task, initialStatus: TaskStatus = 'da_fare'): TaskFormValues {
  if (!task) {
    return { title: '', description: '', status: initialStatus, priority: 'media', assigneeId: '', dueDate: '', estimateHours: '' };
  }
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId === null ? '' : String(task.assigneeId),
    dueDate: task.dueDate ?? '',
    estimateHours: task.estimateHours === null ? '' : hoursFormatter.format(task.estimateHours),
  };
}

export function sameFormValues(a: TaskFormValues, b: TaskFormValues): boolean {
  return (Object.keys(a) as (keyof TaskFormValues)[]).every((key) => a[key] === b[key]);
}

export interface ParsedTask {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: number | null;
  dueDate: string | null;
  estimateHours: number | null;
}

/** Client-side validation with the shared schema plus the project due date rule. */
export function parseTaskForm(values: TaskFormValues, projectDueDate: string | null): { data: ParsedTask; errors: null } | { data: null; errors: FieldErrors } {
  const rawHours = values.estimateHours.trim().replace(',', '.');
  const hours = rawHours === '' ? null : Number(rawHours);
  const errors: FieldErrors = {};
  if (hours !== null && Number.isNaN(hours)) errors.estimateHours = 'Inserisci un numero valido (es. 2,5)';

  const payload = {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
    dueDate: values.dueDate || null,
    estimateHours: hours !== null && Number.isNaN(hours) ? null : hours,
  };
  const result = validate(taskCreateSchema, payload);
  if (result.errors) Object.assign(errors, result.errors, errors);
  const dueError = taskDueDateError(payload.dueDate, projectDueDate);
  if (dueError && !errors.dueDate) errors.dueDate = `${dueError} (${formatDate(projectDueDate)})`;
  if (Object.keys(errors).length > 0 || !result.data) return { data: null, errors };
  return {
    data: {
      title: result.data.title,
      description: result.data.description ?? '',
      status: result.data.status ?? 'da_fare',
      priority: result.data.priority ?? 'media',
      assigneeId: result.data.assigneeId ?? null,
      dueDate: result.data.dueDate ?? null,
      estimateHours: result.data.estimateHours ?? null,
    },
    errors: null,
  };
}

export function TaskFields({
  values,
  errors,
  onChange,
  members,
  projectDueDate,
  disabled = false,
  autoFocus = false,
}: {
  values: TaskFormValues;
  errors: FieldErrors;
  onChange: (values: TaskFormValues, changedField: keyof TaskFormValues) => void;
  members: MemberWithStats[];
  projectDueDate: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => onChange({ ...values, [key]: value }, key);
  const assigneeMissing = values.assigneeId !== '' && !members.some((m) => String(m.id) === values.assigneeId);

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="sr-only">Dati dell’attività</legend>
      <Field label="Titolo" required error={errors.title}>
        <TextInput value={values.title} onChange={(e) => set('title', e.target.value)} maxLength={200} autoFocus={autoFocus} />
      </Field>
      <Field label="Descrizione" error={errors.description}>
        <TextArea value={values.description} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={10000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stato" error={errors.status}>
          <Select value={values.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priorità" error={errors.priority}>
          <Select value={values.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assegnatario" error={errors.assigneeId}>
          <Select value={values.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            <option value="">Non assegnata</option>
            {assigneeMissing && <option value={values.assigneeId}>Membro non più disponibile</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Scadenza"
          error={errors.dueDate}
          hint={projectDueDate ? `Entro il ${formatDate(projectDueDate)} (scadenza del progetto)` : 'Facoltativa'}
        >
          <TextInput type="date" value={values.dueDate} max={projectDueDate ?? undefined} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Stima (ore)" error={errors.estimateHours} hint="Facoltativa, es. 2,5">
          <TextInput inputMode="decimal" value={values.estimateHours} onChange={(e) => set('estimateHours', e.target.value)} placeholder="—" />
        </Field>
      </div>
    </fieldset>
  );
}
