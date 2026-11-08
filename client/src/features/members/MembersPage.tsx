import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import type { MemberWithStats } from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useMembers } from '../../api/queries';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badges';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../components/ui/Feedback';
import { PageHeader } from '../../components/ui/PageHeader';
import { useCurrentMember } from '../../lib/currentMember';
import { useDocumentTitle } from '../../lib/hooks';
import { DeleteMemberDialog, MemberFormDialog } from './MemberDialogs';

export function MembersPage() {
  useDocumentTitle('Membri');
  const { data: members, isLoading, isError, error, refetch } = useMembers();
  const { currentMemberId } = useCurrentMember();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MemberWithStats | null>(null);
  const [deleting, setDeleting] = useState<MemberWithStats | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (member: MemberWithStats) => {
    setEditing(member);
    setFormOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Membri"
        description={members ? `${members.length} ${members.length === 1 ? 'persona' : 'persone'} nel team` : 'Le persone del team'}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={openCreate}>
            Nuovo membro
          </Button>
        }
      />

      {isLoading && (
        <LoadingBlock label="Caricamento dei membri…">
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </LoadingBlock>
      )}

      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}

      {members && members.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nessun membro nel team"
          description="Aggiungi le persone del team per assegnare progetti e attività."
          action={
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={openCreate}>
              Aggiungi il primo membro
            </Button>
          }
        />
      )}

      {members && members.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-sm">
            <caption className="sr-only">Elenco dei membri del team</caption>
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3">Membro</th>
                <th scope="col" className="px-3 py-3">Ruolo</th>
                <th scope="col" className="px-3 py-3 text-right">Attività aperte</th>
                <th scope="col" className="px-3 py-3 text-right">Progetti responsabile</th>
                <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:table-row md:p-0">
                  <td className="flex min-w-0 flex-1 items-center gap-3 md:px-5 md:py-3">
                    <Avatar name={member.name} size="md" decorative />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <span className="truncate">{member.name}</span>
                        {member.id === currentMemberId && <Badge className="bg-brand-50 text-brand-700">Tu</Badge>}
                      </div>
                      <div className="truncate text-slate-500">{member.email}</div>
                    </div>
                  </td>
                  <td className="w-full pl-12 text-slate-700 md:w-auto md:px-3 md:py-3">{member.role}</td>
                  <td className="pl-12 text-slate-700 md:px-3 md:py-3 md:text-right">
                    <span className="md:hidden">Attività aperte: </span>
                    <span className="font-medium tabular-nums">{member.openTaskCount}</span>
                  </td>
                  <td className="text-slate-700 md:px-3 md:py-3 md:text-right">
                    <span className="md:hidden">· Responsabile di: </span>
                    <span className="font-medium tabular-nums">{member.ownedProjectCount}</span>
                  </td>
                  <td className="ml-auto md:px-5 md:py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton label={`Modifica ${member.name}`} size="sm" onClick={() => openEdit(member)}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Elimina ${member.name}`}
                        size="sm"
                        className="hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeleting(member)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MemberFormDialog open={formOpen} onOpenChange={setFormOpen} member={editing} />
      <DeleteMemberDialog member={deleting} members={members ?? []} onClose={() => setDeleting(null)} />
    </div>
  );
}
