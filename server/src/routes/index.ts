import type { FastifyInstance, FastifyReply } from 'fastify';
import { SCHEMA_VERSION } from '../db/migrations';
import { badRequest, notFound } from '../errors';
import * as backup from '../services/backup';
import * as comments from '../services/comments';
import type { ServiceContext } from '../services/context';
import { exportProjectTasksCsv } from '../services/csv';
import { getDashboard } from '../services/dashboard';
import * as members from '../services/members';
import * as projects from '../services/projects';
import * as tasks from '../services/tasks';
import { fileStamp } from '../services/backup';

type IdParams = { Params: { id: string } };
type Query = Record<string, string | undefined>;

const BACKUP_BODY_LIMIT = 50 * 1024 * 1024;

function parseId(value: string | undefined): number {
  if (!value || !/^\d{1,15}$/.test(value) || Number(value) <= 0) throw notFound('Risorsa non trovata');
  return Number(value);
}

function parseOptionalId(value: string | undefined, label: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  if (!/^\d{1,15}$/.test(value) || Number(value) <= 0) throw badRequest(`${label} non valido`);
  return Number(value);
}

const noContent = (reply: FastifyReply) => reply.status(204).send();

export function registerApiRoutes(app: FastifyInstance, ctx: ServiceContext): void {
  app.get('/health', () => ({ status: 'ok', schemaVersion: SCHEMA_VERSION }));

  // Members ------------------------------------------------------------------
  app.get('/members', () => members.listMembers(ctx));
  app.post('/members', (req, reply) => reply.status(201).send(members.createMember(ctx, req.body)));
  app.patch<IdParams>('/members/:id', (req) => members.updateMember(ctx, parseId(req.params.id), req.body));
  app.get<IdParams>('/members/:id/impact', (req) => members.getMemberImpact(ctx, parseId(req.params.id)));
  app.get<IdParams>('/members/:id/open-tasks', (req) => members.listOpenTasksForMember(ctx, parseId(req.params.id)));
  app.delete<IdParams & { Querystring: Query }>('/members/:id', (req, reply) => {
    members.deleteMember(ctx, parseId(req.params.id), parseOptionalId(req.query.reassignOwnerTo, 'Nuovo responsabile'));
    return noContent(reply);
  });

  // Projects -----------------------------------------------------------------
  app.get<{ Querystring: Query }>('/projects', (req) => projects.listProjects(ctx, req.query));
  app.post('/projects', (req, reply) => reply.status(201).send(projects.createProject(ctx, req.body)));
  app.get<IdParams>('/projects/:id', (req) => projects.getProject(ctx, parseId(req.params.id)));
  app.patch<IdParams>('/projects/:id', (req) => projects.updateProject(ctx, parseId(req.params.id), req.body));
  app.delete<IdParams>('/projects/:id', (req, reply) => {
    projects.deleteProject(ctx, parseId(req.params.id));
    return noContent(reply);
  });
  app.get<IdParams>('/projects/:id/tasks', (req) => tasks.listProjectTasks(ctx, parseId(req.params.id)));
  app.post<IdParams>('/projects/:id/tasks', (req, reply) =>
    reply.status(201).send(tasks.createTask(ctx, parseId(req.params.id), req.body)),
  );
  app.get<IdParams & { Querystring: Query }>('/projects/:id/tasks.csv', (req, reply) => {
    const { filename, content } = exportProjectTasksCsv(ctx, parseId(req.params.id), req.query);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Cache-Control', 'no-store')
      .send(content);
  });

  // Tasks --------------------------------------------------------------------
  app.get<IdParams>('/tasks/:id', (req) => tasks.getTask(ctx, parseId(req.params.id)));
  app.patch<IdParams>('/tasks/:id', (req) => tasks.updateTask(ctx, parseId(req.params.id), req.body));
  app.delete<IdParams>('/tasks/:id', (req, reply) => {
    tasks.deleteTask(ctx, parseId(req.params.id));
    return noContent(reply);
  });
  app.post<IdParams>('/tasks/:id/move', (req) => tasks.moveTask(ctx, parseId(req.params.id), req.body));

  // Comments -----------------------------------------------------------------
  app.get<IdParams>('/tasks/:id/comments', (req) => comments.listComments(ctx, parseId(req.params.id)));
  app.post<IdParams>('/tasks/:id/comments', (req, reply) =>
    reply.status(201).send(comments.createComment(ctx, parseId(req.params.id), req.body)),
  );
  app.patch<IdParams>('/comments/:id', (req) => comments.updateComment(ctx, parseId(req.params.id), req.body));
  app.delete<IdParams>('/comments/:id', (req, reply) => {
    comments.deleteComment(ctx, parseId(req.params.id));
    return noContent(reply);
  });

  // Dashboard ----------------------------------------------------------------
  app.get('/dashboard', () => getDashboard(ctx));

  // Backup -------------------------------------------------------------------
  app.get('/backup', (_req, reply) => {
    const file = backup.exportBackup(ctx);
    const name = `backup-gestione-progetti-${fileStamp(ctx.clock.now())}.json`;
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .header('Cache-Control', 'no-store')
      .send(JSON.stringify(file, null, 2));
  });
  app.post('/backup/validate', { bodyLimit: BACKUP_BODY_LIMIT }, (req) => backup.validateBackup(ctx.db, req.body).report);
  app.post('/backup/restore', { bodyLimit: BACKUP_BODY_LIMIT }, (req) => backup.restoreBackup(ctx, req.body));
}
