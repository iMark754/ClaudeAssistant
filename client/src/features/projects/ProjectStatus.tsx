import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, ArchiveRestore, CheckCircle2, ChevronDown, PauseCircle, PlayCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type OpenTasksDetails,
  type Project,
  type ProjectStatus,
} from '@gp/shared';
import { errorMessage, isApiError } from '../../api/client';
import { useUpdateProject } from '../../api/queries';
import { ProjectStatusBadge, TaskStatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, Modal } from '../../components/ui/Dialog';
import { menuContentClass, menuItemClass } from '../../components/ui/Menu';

const OPEN_STATUS_FILTER = 'da_fare,in_corso,in_revisione';

const SUCCESS_MESSAGES: Record<ProjectStatus, string> = {
  attivo: 'Il progetto è attivo',
  in_pausa: 'Il progetto è in pausa',
  completato: 'Progetto completato',
  archiviato: 'Progetto archiviato: ora è in sola lettura',
};

/** Explains why a project cannot be completed and links to the open tasks. */
export function CompletionBlockedDialog({
  projectId,
  message,
  details,
  onClose,
}: {
  projectId: number;
  message: string;
  details: OpenTasksDetails;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const goTo = (taskId?: number) => {
    onClose();
    navigate(`/progetti/${projectId}/lista?stato=${OPEN_STATUS_FILTER}${taskId ? `&attivita=${taskId}` : ''}`);
  };
  const hidden = details.openCount - details.tasks.length;

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Il progetto non può essere completato"
      description={message}
      footer={
        <>
          <Button onClick={onClose}>Chiudi</Button>
          <Button variant="primary" onClick={() => goTo()}>
            Mostra le attività aperte
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-label="Attività aperte per stato">
          {(['da_fare', 'in_corso', 'in_revisione'] as const)
            .filter((s) => details.byStatus[s] > 0)
            .map((s) => (
              <span key={s} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm text-slate-700">
                {TASK_STATUS_LABELS[s]}: <strong className="tabular-nums">{details.byStatus[s]}</strong>
              </span>
            ))}
        </div>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {details.tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => goTo(task.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <span className="min-w-0 truncate font-medium text-slate-800">{task.title}</span>
                <TaskStatusBadge status={task.status} />
              </button>
            </li>
          ))}
        </ul>
        {hidden > 0 && <p className="text-sm text-slate-500">…e altre {hidden} attività.</p>}
      </div>
    </Modal>
  );
}

/** Status changes with archive confirmation and the "cannot complete" explanation. */
export function useProjectStatusChange(project: Project | undefined) {
  const update = useUpdateProject();
  const [blocked, setBlocked] = useState<{ message: string; details: OpenTasksDetails } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const apply = (status: ProjectStatus) => {
    if (!project) return;
    update.mutate(
      { id: project.id, version: project.version, status },
      {
        onSuccess: () => {
          setConfirmArchive(false);
          toast.success(project.status === 'archiviato' ? 'Progetto ripristinato' : SUCCESS_MESSAGES[status]);
        },
        onError: (error) => {
          setConfirmArchive(false);
          if (isApiError(error, 'PROJECT_HAS_OPEN_TASKS')) {
            setBlocked({ message: error.message, details: error.details as OpenTasksDetails });
          } else {
            toast.error(errorMessage(error));
          }
        },
      },
    );
  };

  const request = (status: ProjectStatus) => (status === 'archiviato' ? setConfirmArchive(true) : apply(status));

  const dialogs: ReactNode = project ? (
    <>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archiviare il progetto?"
        description="Il progetto diventerà di sola lettura: non sarà possibile modificarlo né modificare, spostare o commentare le sue attività finché non verrà ripristinato."
        confirmLabel="Archivia"
        tone="primary"
        loading={update.isPending}
        onConfirm={() => apply('archiviato')}
      />
      {blocked && (
        <CompletionBlockedDialog projectId={project.id} message={blocked.message} details={blocked.details} onClose={() => setBlocked(null)} />
      )}
    </>
  ) : null;

  return { request, dialogs, pending: update.isPending };
}

interface StatusAction {
  status: ProjectStatus;
  label: string;
  icon: ReactNode;
}

function actionsFor(status: ProjectStatus): StatusAction[] {
  const icon = (Icon: typeof PlayCircle) => <Icon className="size-4 text-slate-500" aria-hidden="true" />;
  switch (status) {
    case 'attivo':
      return [
        { status: 'in_pausa', label: 'Metti in pausa', icon: icon(PauseCircle) },
        { status: 'completato', label: 'Segna come completato', icon: icon(CheckCircle2) },
        { status: 'archiviato', label: 'Archivia', icon: icon(Archive) },
      ];
    case 'in_pausa':
      return [
        { status: 'attivo', label: 'Riattiva', icon: icon(PlayCircle) },
        { status: 'completato', label: 'Segna come completato', icon: icon(CheckCircle2) },
        { status: 'archiviato', label: 'Archivia', icon: icon(Archive) },
      ];
    case 'completato':
      return [
        { status: 'attivo', label: 'Riapri il progetto', icon: icon(PlayCircle) },
        { status: 'archiviato', label: 'Archivia', icon: icon(Archive) },
      ];
    case 'archiviato':
      return [
        { status: 'attivo', label: 'Ripristina come attivo', icon: icon(ArchiveRestore) },
        { status: 'in_pausa', label: 'Ripristina in pausa', icon: icon(ArchiveRestore) },
        { status: 'completato', label: 'Ripristina come completato', icon: icon(ArchiveRestore) },
      ];
  }
}

export function ProjectStatusMenu({ project }: { project: Project }) {
  const { request, dialogs, pending } = useProjectStatusChange(project);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={pending}
            aria-label={`Stato del progetto: ${PROJECT_STATUS_LABELS[project.status]}. Cambia stato`}
            className="inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 hover:bg-slate-100 disabled:opacity-60"
          >
            <ProjectStatusBadge status={project.status} />
            <ChevronDown className="size-4 text-slate-500" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className={menuContentClass}>
            <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Cambia stato
            </DropdownMenu.Label>
            {actionsFor(project.status).map((action) => (
              <DropdownMenu.Item key={action.status} className={menuItemClass} onSelect={() => request(action.status)}>
                {action.icon}
                {action.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {dialogs}
    </>
  );
}
