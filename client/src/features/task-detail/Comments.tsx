import { MessageSquare } from 'lucide-react';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { formatDateTime, formatRelativeTime, type Comment } from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from '../../api/queries';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Callout, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { TextArea } from '../../components/ui/Form';
import { useCurrentMember } from '../../lib/currentMember';

function submitOnCtrlEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

function CommentItem({ comment, canEdit, taskId }: { comment: Comment; canEdit: boolean; taskId: number }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useUpdateComment(taskId);
  const remove = useDeleteComment(taskId);
  const editId = useId();

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    update.mutate(
      { id: comment.id, body },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <li className="flex gap-3">
      <Avatar name={comment.authorName} size="sm" decorative />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-slate-900">{comment.authorName}</span>
          {comment.authorDeleted && <Badge className="bg-slate-100 text-slate-500">ex membro</Badge>}
          <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)} className="text-xs text-slate-500">
            {formatRelativeTime(comment.createdAt)}
          </time>
          {comment.updatedAt !== comment.createdAt && (
            <span className="text-xs text-slate-400" title={`Modificato: ${formatDateTime(comment.updatedAt)}`}>
              (modificato)
            </span>
          )}
        </div>
        {editing ? (
          <form onSubmit={save} className="mt-1.5 space-y-2">
            <label htmlFor={editId} className="sr-only">
              Modifica il commento
            </label>
            <TextArea id={editId} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={submitOnCtrlEnter} rows={3} autoFocus maxLength={5000} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary" loading={update.isPending} disabled={!body.trim()}>
                Salva
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBody(comment.body);
                  setEditing(false);
                }}
              >
                Annulla
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 text-sm whitespace-pre-wrap break-words text-slate-700">{comment.body}</p>
        )}
        {canEdit && !editing && (
          <div className="mt-1 flex gap-3 text-xs">
            <button type="button" className="font-medium text-slate-500 hover:text-slate-900 hover:underline" onClick={() => setEditing(true)}>
              Modifica
            </button>
            <button type="button" className="font-medium text-slate-500 hover:text-red-700 hover:underline" onClick={() => setConfirmDelete(true)}>
              Elimina
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminare il commento?"
        description="Il commento verrà eliminato definitivamente."
        confirmLabel="Elimina"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(comment.id, {
            onSuccess: () => setConfirmDelete(false),
            onError: (error) => {
              setConfirmDelete(false);
              toast.error(errorMessage(error));
            },
          })
        }
      />
    </li>
  );
}

export function Comments({ taskId, readOnly }: { taskId: number; readOnly: boolean }) {
  const { data: comments, isLoading, isError, error, refetch } = useComments(taskId);
  const { currentMember } = useCurrentMember();
  const create = useCreateComment(taskId);
  const [body, setBody] = useState('');
  const inputId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentMember || !body.trim()) return;
    create.mutate(
      { body, authorId: currentMember.id },
      {
        onSuccess: () => setBody(''),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <section aria-labelledby={`${inputId}-title`} className="space-y-4">
      <h3 id={`${inputId}-title`} className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <MessageSquare className="size-4 text-slate-500" aria-hidden="true" />
        Commenti {comments && comments.length > 0 && <span className="font-normal text-slate-500">({comments.length})</span>}
      </h3>

      {isLoading && (
        <div className="space-y-3" role="status">
          <span className="sr-only">Caricamento dei commenti…</span>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-4/5" />
        </div>
      )}
      {isError && <ErrorState title="Impossibile caricare i commenti" message={errorMessage(error)} onRetry={() => refetch()} />}
      {comments && comments.length === 0 && <p className="text-sm text-slate-500">Ancora nessun commento.</p>}
      {comments && comments.length > 0 && (
        <ol className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              taskId={taskId}
              canEdit={!readOnly && currentMember !== null && comment.authorId === currentMember.id}
            />
          ))}
        </ol>
      )}

      {!readOnly && currentMember && (
        <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
            Aggiungi un commento come {currentMember.name}
          </label>
          <TextArea
            id={inputId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={submitOnCtrlEnter}
            rows={3}
            maxLength={5000}
            placeholder="Scrivi un aggiornamento, una domanda o una decisione…"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">Ctrl + Invio per inviare</span>
            <Button type="submit" variant="primary" size="sm" loading={create.isPending} disabled={!body.trim()}>
              Commenta
            </Button>
          </div>
        </form>
      )}
      {!readOnly && !currentMember && (
        <Callout tone="info">Per commentare scegli chi sei dal selettore nell’intestazione.</Callout>
      )}
    </section>
  );
}
