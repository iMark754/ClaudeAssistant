import type { Comment } from '@gp/shared';
import type { Database } from '../db/database';

export interface CommentRow {
  id: number;
  task_id: number;
  author_id: number | null;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface CommentWithMemberRow extends CommentRow {
  member_name: string | null;
}

const SELECT = `
  SELECT c.*, m.name AS member_name
  FROM comments c LEFT JOIN members m ON m.id = c.author_id
`;

function mapComment(row: CommentWithMemberRow): Comment {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    // Current name if the member still exists, otherwise the snapshot taken when writing.
    authorName: row.member_name ?? row.author_name,
    authorDeleted: row.author_id === null,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listComments(db: Database, taskId: number): Comment[] {
  return db.all<CommentWithMemberRow>(`${SELECT} WHERE c.task_id = ? ORDER BY c.created_at, c.id`, [taskId]).map(mapComment);
}

export function getComment(db: Database, id: number): Comment | undefined {
  const row = db.get<CommentWithMemberRow>(`${SELECT} WHERE c.id = ?`, [id]);
  return row ? mapComment(row) : undefined;
}

export function findCommentRow(db: Database, id: number): CommentRow | undefined {
  return db.get<CommentRow>('SELECT * FROM comments WHERE id = ?', [id]);
}

export function insertComment(
  db: Database,
  values: { taskId: number; authorId: number; authorName: string; body: string },
  now: string,
): number {
  return db.run(
    `INSERT INTO comments (task_id, author_id, author_name, body, created_at, updated_at)
     VALUES (:taskId, :authorId, :authorName, :body, :now, :now)`,
    { ...values, now },
  ).lastInsertRowid;
}

export function updateComment(db: Database, id: number, body: string, now: string): void {
  db.run('UPDATE comments SET body = ?, updated_at = ? WHERE id = ?', [body, now, id]);
}

export function deleteComment(db: Database, id: number): void {
  db.run('DELETE FROM comments WHERE id = ?', [id]);
}
