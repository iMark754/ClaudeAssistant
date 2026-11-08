import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { formatDate, projectCreateSchema, todayInRome, type Project } from '@gp/shared';
import { useCreateProject, useMembers, useUpdateProject } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Dialog';
import { Field, Select, TextArea, TextInput } from '../../components/ui/Form';
import { useCurrentMember } from '../../lib/currentMember';
import { handleFormError, validate, type FieldErrors } from '../../lib/forms';

interface FormValues {
  name: string;
  description: string;
  startDate: string;
  dueDate: string;
  ownerId: string;
  status: 'attivo' | 'in_pausa';
}

function initialValues(project: Project | null, currentMemberId: number | null): FormValues {
  if (project) {
    return {
      name: project.name,
      description: project.description,
      startDate: project.startDate,
      dueDate: project.dueDate ?? '',
      ownerId: String(project.ownerId),
      status: 'attivo',
    };
  }
  return { name: '', description: '', startDate: todayInRome(), dueDate: '', ownerId: currentMemberId ? String(currentMemberId) : '', status: 'attivo' };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create */
  project: Project | null;
}) {
  const formId = useId();
  const navigate = useNavigate();
  const { currentMemberId } = useCurrentMember();
  const { data: members } = useMembers();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [values, setValues] = useState<FormValues>(() => initialValues(project, currentMemberId));
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues(project, currentMemberId));
      setErrors({});
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: values.name,
      description: values.description,
      startDate: values.startDate,
      dueDate: values.dueDate || null,
      ownerId: values.ownerId ? Number(values.ownerId) : undefined,
      ...(project ? {} : { status: values.status }),
    };
    const result = validate(projectCreateSchema, payload);
    if (result.errors || !values.ownerId) {
      return setErrors({
        ...(result.errors ?? {}),
        ...(!values.ownerId ? { ownerId: 'Scegli il responsabile del progetto' } : {}),
      });
    }

    if (!project) {
      create.mutate(result.data, {
        onSuccess: (created) => {
          toast.success('Progetto creato');
          onOpenChange(false);
          navigate(`/progetti/${created.id}/kanban`);
        },
        onError: (error) => handleFormError(error, setErrors),
      });
      return;
    }

    // Send only the fields that changed.
    const changes: Record<string, unknown> = {};
    if (result.data.name !== project.name) changes.name = result.data.name;
    if ((result.data.description ?? '') !== project.description) changes.description = result.data.description ?? '';
    if (result.data.startDate !== project.startDate) changes.startDate = result.data.startDate;
    if ((result.data.dueDate ?? null) !== project.dueDate) changes.dueDate = result.data.dueDate ?? null;
    if (result.data.ownerId !== project.ownerId) changes.ownerId = result.data.ownerId;
    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }
    update.mutate(
      { id: project.id, version: project.version, ...changes },
      {
        onSuccess: () => {
          toast.success('Progetto aggiornato');
          onOpenChange(false);
        },
        onError: (error) => handleFormError(error, setErrors),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={project ? 'Modifica progetto' : 'Nuovo progetto'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button type="submit" form={formId} variant="primary" loading={create.isPending || update.isPending}>
            {project ? 'Salva modifiche' : 'Crea progetto'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome" required error={errors.name}>
          <TextInput value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Descrizione" error={errors.description}>
          <TextArea value={values.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={5000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data di inizio" required error={errors.startDate}>
            <TextInput type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Scadenza" error={errors.dueDate} hint="Facoltativa">
            <TextInput type="date" value={values.dueDate} min={values.startDate || undefined} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsabile" required error={errors.ownerId}>
            <Select value={values.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
              <option value="">Scegli un membro…</option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          {!project && (
            <Field label="Stato iniziale" error={errors.status}>
              <Select value={values.status} onChange={(e) => set('status', e.target.value as FormValues['status'])}>
                <option value="attivo">Attivo</option>
                <option value="in_pausa">In pausa</option>
              </Select>
            </Field>
          )}
        </div>
        {project?.dueDate && values.dueDate && values.dueDate < project.dueDate && (
          <p className="text-xs text-slate-500">
            Anticipando la scadenza (ora {formatDate(project.dueDate)}) nessuna attività potrà avere una scadenza successiva.
          </p>
        )}
      </form>
    </Modal>
  );
}
