import { useEffect, useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { PROJECT_STATUS_LABELS, ROLE_SUGGESTIONS, memberCreateSchema, plural, type MemberWithStats } from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useCreateMember, useDeleteMember, useMemberImpact, useUpdateMember } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Dialog';
import { Callout, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Field, Select, TextInput } from '../../components/ui/Form';
import { useCurrentMember } from '../../lib/currentMember';
import { handleFormError, validate, type FieldErrors } from '../../lib/forms';

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberWithStats | null;
}) {
  const formId = useId();
  const rolesId = useId();
  const [values, setValues] = useState({ name: '', email: '', role: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateMember();
  const update = useUpdateMember();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setValues(member ? { name: member.name, email: member.email, role: member.role } : { name: '', email: '', role: '' });
      setErrors({});
    }
  }, [open, member]);

  const set = (key: keyof typeof values) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(memberCreateSchema, values);
    if (result.errors) return setErrors(result.errors);
    const options = {
      onSuccess: () => {
        toast.success(member ? 'Membro aggiornato' : `${result.data.name} è stato aggiunto al team`);
        onOpenChange(false);
      },
      onError: (error: unknown) => handleFormError(error, setErrors),
    };
    if (member) update.mutate({ id: member.id, ...result.data }, options);
    else create.mutate(result.data, options);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={member ? 'Modifica membro' : 'Nuovo membro'}
      size="sm"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button type="submit" form={formId} variant="primary" loading={pending}>
            {member ? 'Salva modifiche' : 'Aggiungi membro'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome e cognome" required error={errors.name}>
          <TextInput value={values.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" autoFocus maxLength={100} />
        </Field>
        <Field label="Email" required error={errors.email} hint="Deve essere univoca nel team.">
          <TextInput type="email" value={values.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Ruolo" required error={errors.role} hint="Scegli un suggerimento o scrivi un ruolo libero.">
          <TextInput list={rolesId} value={values.role} onChange={(e) => set('role')(e.target.value)} maxLength={60} />
        </Field>
        <datalist id={rolesId}>
          {ROLE_SUGGESTIONS.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}

export function DeleteMemberDialog({
  member,
  members,
  onClose,
}: {
  member: MemberWithStats | null;
  members: MemberWithStats[];
  onClose: () => void;
}) {
  const impact = useMemberImpact(member?.id ?? null);
  const remove = useDeleteMember();
  const { currentMemberId, setCurrentMemberId } = useCurrentMember();
  const [newOwner, setNewOwner] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);

  useEffect(() => {
    setNewOwner('');
    setOwnerError(null);
  }, [member?.id]);

  if (!member) return null;
  const owned = impact.data?.ownedProjects ?? [];
  const candidates = members.filter((m) => m.id !== member.id);

  const onConfirm = () => {
    if (owned.length > 0 && !newOwner) {
      setOwnerError('Scegli il nuovo responsabile dei progetti');
      return;
    }
    remove.mutate(
      { id: member.id, reassignOwnerTo: owned.length > 0 ? Number(newOwner) : undefined },
      {
        onSuccess: () => {
          const unassigned = impact.data?.assignedTaskCount ?? 0;
          toast.success(
            unassigned === 0
              ? `${member.name} è stato eliminato.`
              : unassigned === 1
                ? `${member.name} è stato eliminato. 1 attività è ora non assegnata.`
                : `${member.name} è stato eliminato. ${unassigned} attività sono ora non assegnate.`,
          );
          if (currentMemberId === member.id) setCurrentMemberId(null);
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !remove.isPending && onClose()}
      title={`Eliminare ${member.name}?`}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={remove.isPending}>
            Annulla
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={remove.isPending} disabled={impact.isLoading || impact.isError}>
            Elimina membro
          </Button>
        </>
      }
    >
      {impact.isLoading && (
        <div className="space-y-2" role="status">
          <span className="sr-only">Calcolo delle conseguenze…</span>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
      {impact.isError && <ErrorState message={errorMessage(impact.error)} onRetry={() => impact.refetch()} />}
      {impact.data && (
        <div className="space-y-4 text-sm text-slate-700">
          <p>L’eliminazione non cancella il lavoro svolto:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {impact.data.assignedTaskCount === 0
                ? 'Non ha attività assegnate.'
                : impact.data.assignedTaskCount === 1
                  ? `1 attività assegnata tornerà non assegnata${impact.data.openTaskCount > 0 ? ' (ancora aperta)' : ''}.`
                  : `${impact.data.assignedTaskCount} attività assegnate torneranno non assegnate${impact.data.openTaskCount > 0 ? ` (${impact.data.openTaskCount} ancora aperte)` : ''}.`}
            </li>
            <li>
              {impact.data.commentCount === 0
                ? 'Non ha scritto commenti.'
                : `${plural(impact.data.commentCount, 'commento resterà visibile', 'commenti resteranno visibili')} con il suo nome.`}
            </li>
          </ul>
          {owned.length > 0 && (
            <Callout tone="warning" title={`È responsabile di ${plural(owned.length, 'progetto', 'progetti')}`}>
              <ul className="mt-1 list-disc pl-5">
                {owned.map((p) => (
                  <li key={p.id}>
                    {p.name} <span className="text-amber-800">({PROJECT_STATUS_LABELS[p.status].toLowerCase()})</span>
                  </li>
                ))}
              </ul>
            </Callout>
          )}
          {owned.length > 0 && (
            <Field label="Nuovo responsabile" required error={ownerError}>
              <Select
                value={newOwner}
                onChange={(e) => {
                  setNewOwner(e.target.value);
                  setOwnerError(null);
                }}
              >
                <option value="">Scegli un membro…</option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.role}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {owned.length > 0 && candidates.length === 0 && (
            <Callout tone="danger">Aggiungi prima un altro membro a cui assegnare i progetti.</Callout>
          )}
        </div>
      )}
    </Modal>
  );
}
