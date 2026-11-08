import { commentCreateSchema, commentUpdateSchema, type Comment } from '@gp/shared';
import { nowIso } from '../clock';
import { fieldError, notFound } from '../errors';
import * as comments from '../repositories/comments';
import { findMember } from '../repositories/members';
import { findTaskRow } from '../repositories/tasks';
import { assertProjectWritable, type ServiceContext } from './context';
import { requireProjectRow } from './projects';

const commentNotFound = () => notFound('Commento non trovato');

function requireWritableTask(ctx: ServiceContext, taskId: number) {
  const task = findTaskRow(ctx.db, taskId);
  if (!task) throw notFound('Attività non trovata');
  assertProjectWritable(requireProjectRow(ctx, task.project_id));
  return task;
}

export function listComments(ctx: ServiceContext, taskId: number): Comment[] {
  if (!findTaskRow(ctx.db, taskId)) throw notFound('Attività non trovata');
  return comments.listComments(ctx.db, taskId);
}

export function createComment(ctx: ServiceContext, taskId: number, input: unknown): Comment {
  const data = commentCreateSchema.parse(input);
  return ctx.db.transaction(() => {
    requireWritableTask(ctx, taskId);
    const author = findMember(ctx.db, data.authorId);
    if (!author) throw fieldError('authorId', 'Seleziona un membro valido per commentare', 'INVALID_REFERENCE');
    const id = comments.insertComment(
      ctx.db,
      { taskId, authorId: author.id, authorName: author.name, body: data.body },
      nowIso(ctx.clock),
    );
    return comments.getComment(ctx.db, id)!;
  });
}

export function updateComment(ctx: ServiceContext, id: number, input: unknown): Comment {
  const data = commentUpdateSchema.parse(input);
  return ctx.db.transaction(() => {
    const comment = comments.findCommentRow(ctx.db, id);
    if (!comment) throw commentNotFound();
    requireWritableTask(ctx, comment.task_id);
    comments.updateComment(ctx.db, id, data.body, nowIso(ctx.clock));
    return comments.getComment(ctx.db, id)!;
  });
}

export function deleteComment(ctx: ServiceContext, id: number): void {
  ctx.db.transaction(() => {
    const comment = comments.findCommentRow(ctx.db, id);
    if (!comment) throw commentNotFound();
    requireWritableTask(ctx, comment.task_id);
    comments.deleteComment(ctx.db, id);
  });
}
