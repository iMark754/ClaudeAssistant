import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Project, TaskStatus } from '@gp/shared';
import { useCreateTask, useMembers } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Dialog';
import { handleFormError, type FieldErrors } from '../../lib/forms';
import { TaskFields, parseTaskForm, toFormValues, type TaskFormValues } from './TaskFields';

export function TaskFormDialog({
  project,
  initialStatus,
  onClose,
  onCreated,
}: {
  project: Project;
  initialStatus: TaskStatus;
  onClose: () => void;
  onCreated: (taskId: number) => void;
}) {
  const formId = useId();
  const { data: members } = useMembers();
  const create = useCreateTask(project.id);
  const [values, setValues] = useState<TaskFormValues>(() => toFormValues(undefined, initialStatus));
  const [errors, setErrors] = useState<FieldErrors>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = parseTaskForm(values, project.dueDate);
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (task) => {
        toast.success('Attività creata', { action: { label: 'Apri', onClick: () => onCreated(task.id) } });
        onClose();
      },
      onError: (error) => handleFormError(error, setErrors),
    });
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Nuova attività"
      description={`Progetto: ${project.name}`}
      footer={
        <>
          <Button onClick={onClose}>Annulla</Button>
          <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
            Crea attività
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        <TaskFields
          values={values}
          errors={errors}
          onChange={(next, field) => {
            setValues(next);
            setErrors((e) => ({ ...e, [field]: '' }));
          }}
          members={members ?? []}
          projectDueDate={project.dueDate}
          autoFocus
        />
      </form>
    </Modal>
  );
}
