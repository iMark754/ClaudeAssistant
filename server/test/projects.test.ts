import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Project, ProjectListResponse } from '@gp/shared';
import { createTestContext, type TestContext } from './helpers';

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext();
});
afterEach(async () => {
  await t.close();
});

describe('projects CRUD', () => {
  it('creates, reads, updates and deletes a project', async () => {
    const owner = await t.member({ name: 'Giulia Romano' });
    const created = await t.project(owner.id, { name: 'Sito web', description: 'Nuovo sito' });
    expect(created).toMatchObject({
      name: 'Sito web',
      status: 'attivo',
      ownerName: 'Giulia Romano',
      version: 1,
      taskCount: 0,
      progress: 0,
    });

    const updated = await t.patch<Project>(`/projects/${created.id}`, { version: 1, name: 'Sito istituzionale' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'Sito istituzionale', version: 2 });

    expect((await t.del(`/projects/${created.id}`)).status).toBe(204);
    expect((await t.get(`/projects/${created.id}`)).status).toBe(404);
  });

  it('validates input with Italian messages', async () => {
    const owner = await t.member();
    const res = await t.post('/projects', { name: '', startDate: '2026-11-10', dueDate: '2026-11-01', ownerId: owner.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fieldErrors.name).toBe('Il nome del progetto è obbligatorio');
    expect(res.body.error.fieldErrors.dueDate).toBe('La scadenza non può precedere la data di inizio');

    const missingOwner = await t.post('/projects', { name: 'X', startDate: '2026-11-01', ownerId: 999 });
    expect(missingOwner.status).toBe(422);
    expect(missingOwner.body.error.field).toBe('ownerId');
  });

  it('rejects stale updates (optimistic locking)', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    await t.patch(`/projects/${project.id}`, { version: 1, name: 'Prima modifica' });
    const stale = await t.patch(`/projects/${project.id}`, { version: 1, name: 'Seconda modifica' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_VERSION');
  });
});

describe('project list', () => {
  it('computes progress and overdue counts', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    await t.task(project.id, { status: 'fatto' });
    await t.task(project.id, { status: 'fatto' });
    await t.task(project.id, { status: 'in_corso', dueDate: '2026-11-07' });
    const res = await t.get<Project>(`/projects/${project.id}`);
    expect(res.body).toMatchObject({ taskCount: 3, doneCount: 2, openCount: 1, overdueCount: 1, progress: 67 });
  });

  it('searches ignoring accents, filters by status and sorts', async () => {
    const owner = await t.member();
    const a = await t.project(owner.id, { name: 'Attività commerciali', dueDate: '2026-12-20' });
    const b = await t.project(owner.id, { name: 'App mobile', dueDate: '2026-11-30' });
    const c = await t.project(owner.id, { name: 'Formazione', dueDate: null, status: 'in_pausa' });
    await t.task(b.id, { status: 'fatto' });

    const search = await t.get<ProjectListResponse>('/projects?q=attivita');
    expect(search.body.items.map((p) => p.id)).toEqual([a.id]);

    const paused = await t.get<ProjectListResponse>('/projects?status=in_pausa');
    expect(paused.body.items.map((p) => p.id)).toEqual([c.id]);
    expect(paused.body.statusCounts).toMatchObject({ attivo: 2, in_pausa: 1, completato: 0, archiviato: 0 });

    const byDue = await t.get<ProjectListResponse>('/projects?sort=due&dir=asc');
    expect(byDue.body.items.map((p) => p.id)).toEqual([b.id, a.id, c.id]);
    const byDueDesc = await t.get<ProjectListResponse>('/projects?sort=due&dir=desc');
    expect(byDueDesc.body.items.map((p) => p.id)).toEqual([a.id, b.id, c.id]);

    const byProgress = await t.get<ProjectListResponse>('/projects?sort=progress&dir=desc');
    expect(byProgress.body.items[0]!.id).toBe(b.id);
  });
});

describe('business rules', () => {
  it('blocks completion while tasks are open and explains why', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    const open = await t.task(project.id, { title: 'Da chiudere', status: 'in_corso' });
    await t.task(project.id, { title: 'Ancora da fare' });
    await t.task(project.id, { status: 'fatto' });

    const res = await t.patch(`/projects/${project.id}`, { version: 1, status: 'completato' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROJECT_HAS_OPEN_TASKS');
    expect(res.body.error.message).toMatch(/2 attività non fatte/);
    expect(res.body.error.details).toMatchObject({ openCount: 2, byStatus: { da_fare: 1, in_corso: 1, in_revisione: 0 } });
    expect(res.body.error.details.tasks.map((x: { title: string }) => x.title)).toContain('Da chiudere');

    // Once everything is done, completion succeeds.
    const tasks = (await t.get(`/projects/${project.id}/tasks`)).body as { id: number; version: number; status: string }[];
    for (const task of tasks.filter((x) => x.status !== 'fatto')) {
      expect((await t.patch(`/tasks/${task.id}`, { version: task.version, status: 'fatto' })).status).toBe(200);
    }
    const ok = await t.patch<Project>(`/projects/${project.id}`, { version: 1, status: 'completato' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('completato');
    expect(open.id).toBeGreaterThan(0);
  });

  it('keeps a completed project consistent', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id, { status: 'completato' });
    const blocked = await t.post(`/projects/${project.id}/tasks`, { title: 'Nuova' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PROJECT_COMPLETED');
    const done = await t.task(project.id, { title: 'Già fatta', status: 'fatto' });
    const reopen = await t.patch(`/tasks/${done.id}`, { version: done.version, status: 'in_corso' });
    expect(reopen.body.error.code).toBe('PROJECT_COMPLETED');
    const move = await t.post(`/tasks/${done.id}/move`, { status: 'da_fare' });
    expect(move.body.error.code).toBe('PROJECT_COMPLETED');
  });

  it('makes archived projects read-only, except for restoring them', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    const task = await t.task(project.id);
    const archived = await t.patch<Project>(`/projects/${project.id}`, { version: 1, status: 'archiviato' });
    expect(archived.body.status).toBe('archiviato');
    const v = archived.body.version;

    const attempts = [
      await t.patch(`/projects/${project.id}`, { version: v, name: 'Rinominato' }),
      await t.patch(`/projects/${project.id}`, { version: v, status: 'attivo', name: 'Rinominato' }),
      await t.del(`/projects/${project.id}`),
      await t.post(`/projects/${project.id}/tasks`, { title: 'Nuova' }),
      await t.patch(`/tasks/${task.id}`, { version: task.version, title: 'Modificata' }),
      await t.post(`/tasks/${task.id}/move`, { status: 'in_corso' }),
      await t.del(`/tasks/${task.id}`),
      await t.post(`/tasks/${task.id}/comments`, { body: 'Ciao', authorId: owner.id }),
    ];
    for (const res of attempts) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PROJECT_ARCHIVED');
    }

    // Reading and exporting still work.
    expect((await t.get(`/projects/${project.id}/tasks`)).status).toBe(200);
    expect((await t.get(`/projects/${project.id}/tasks.csv`)).status).toBe(200);

    const restored = await t.patch<Project>(`/projects/${project.id}`, { version: v, status: 'in_pausa' });
    expect(restored.status).toBe(200);
    expect(restored.body.status).toBe('in_pausa');
  });

  it('applies the completion rule when restoring an archived project as completed', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    await t.task(project.id);
    const archived = await t.patch<Project>(`/projects/${project.id}`, { version: 1, status: 'archiviato' });
    const res = await t.patch(`/projects/${project.id}`, { version: archived.body.version, status: 'completato' });
    expect(res.body.error.code).toBe('PROJECT_HAS_OPEN_TASKS');
  });

  it('does not allow moving the project due date before task due dates', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id, { dueDate: '2026-12-31' });
    await t.task(project.id, { title: 'Consegna', dueDate: '2026-12-20' });
    const res = await t.patch(`/projects/${project.id}`, { version: 1, dueDate: '2026-12-10' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PROJECT_DUE_BEFORE_TASKS');
    expect(res.body.error.field).toBe('dueDate');
    expect(res.body.error.details).toMatchObject({ count: 1, tasks: [{ title: 'Consegna', dueDate: '2026-12-20' }] });

    expect((await t.patch(`/projects/${project.id}`, { version: 1, dueDate: '2026-12-20' })).status).toBe(200);
  });
});
