import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Comment, MoveTaskResult, Task, TaskSummary } from '@gp/shared';
import { createTestContext, type TestContext } from './helpers';

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext();
});
afterEach(async () => {
  await t.close();
});

async function column(projectId: number, status: string): Promise<string[]> {
  const res = await t.get<TaskSummary[]>(`/projects/${projectId}/tasks`);
  return res.body
    .filter((x) => x.status === status)
    .sort((a, b) => a.position - b.position)
    .map((x) => x.title);
}

describe('tasks CRUD', () => {
  it('creates tasks with defaults and full details', async () => {
    const owner = await t.member({ name: 'Luca Bianchi' });
    const project = await t.project(owner.id);
    const task = await t.task(project.id, {
      title: '  Configurare CI  ',
      assigneeId: owner.id,
      estimateHours: 3.5,
      dueDate: '2026-11-20',
      priority: 'alta',
    });
    expect(task).toMatchObject({
      title: 'Configurare CI',
      description: '',
      status: 'da_fare',
      priority: 'alta',
      assigneeName: 'Luca Bianchi',
      estimateHours: 3.5,
      dueDate: '2026-11-20',
      commentCount: 0,
      project: { id: project.id, name: project.name, status: 'attivo', dueDate: '2026-12-31' },
    });

    const updated = await t.patch<Task>(`/tasks/${task.id}`, { version: task.version, status: 'fatto', assigneeId: null });
    expect(updated.body).toMatchObject({ status: 'fatto', assigneeId: null, assigneeName: null });
    expect(updated.body.completedAt).not.toBeNull();

    const reopened = await t.patch<Task>(`/tasks/${task.id}`, { version: updated.body.version, status: 'in_corso' });
    expect(reopened.body.completedAt).toBeNull();

    expect((await t.del(`/tasks/${task.id}`)).status).toBe(204);
    expect((await t.get(`/tasks/${task.id}`)).status).toBe(404);
  });

  it('rejects a due date later than the project due date', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id, { dueDate: '2026-11-30' });
    const res = await t.post(`/projects/${project.id}/tasks`, { title: 'Troppo tardi', dueDate: '2026-12-01' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'TASK_DUE_AFTER_PROJECT', field: 'dueDate' });
    expect(res.body.error.message).toContain('30 nov 2026');

    const task = await t.task(project.id, { dueDate: '2026-11-30' });
    const update = await t.patch(`/tasks/${task.id}`, { version: task.version, dueDate: '2026-12-15' });
    expect(update.body.error.code).toBe('TASK_DUE_AFTER_PROJECT');

    // Without a project due date any task due date is allowed.
    const open = await t.project(owner.id, { dueDate: null });
    expect((await t.post(`/projects/${open.id}/tasks`, { title: 'Libera', dueDate: '2030-01-01' })).status).toBe(201);
  });

  it('rejects unknown assignees and stale versions', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    expect((await t.post(`/projects/${project.id}/tasks`, { title: 'X', assigneeId: 999 })).body.error.field).toBe('assigneeId');
    const task = await t.task(project.id);
    await t.patch(`/tasks/${task.id}`, { version: task.version, title: 'A' });
    expect((await t.patch(`/tasks/${task.id}`, { version: task.version, title: 'B' })).body.error.code).toBe('STALE_VERSION');
  });

  it('puts a task whose status changes from the form at the bottom of the new column', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    await t.task(project.id, { title: 'A', status: 'in_corso' });
    const b = await t.task(project.id, { title: 'B' });
    await t.patch(`/tasks/${b.id}`, { version: b.version, status: 'in_corso' });
    expect(await column(project.id, 'in_corso')).toEqual(['A', 'B']);
  });
});

describe('kanban moves', () => {
  it('reorders within a column and moves across columns', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    const a = await t.task(project.id, { title: 'A' });
    const b = await t.task(project.id, { title: 'B' });
    const c = await t.task(project.id, { title: 'C' });
    expect(await column(project.id, 'da_fare')).toEqual(['A', 'B', 'C']);

    // C to the top
    let res = await t.post<MoveTaskResult>(`/tasks/${c.id}/move`, { status: 'da_fare', prevId: null, nextId: a.id });
    expect(res.status).toBe(200);
    expect(await column(project.id, 'da_fare')).toEqual(['C', 'A', 'B']);

    // A after B
    await t.post(`/tasks/${a.id}/move`, { status: 'da_fare', prevId: b.id });
    expect(await column(project.id, 'da_fare')).toEqual(['C', 'B', 'A']);

    // B into "fatto" (empty column)
    res = await t.post(`/tasks/${b.id}/move`, { status: 'fatto', prevId: null, nextId: null });
    expect(res.body.task.status).toBe('fatto');
    expect(res.body.task.completedAt).not.toBeNull();
    expect(await column(project.id, 'da_fare')).toEqual(['C', 'A']);
    expect(await column(project.id, 'fatto')).toEqual(['B']);

    // A into "fatto" above B
    await t.post(`/tasks/${a.id}/move`, { status: 'fatto', nextId: b.id });
    expect(await column(project.id, 'fatto')).toEqual(['A', 'B']);
  });

  it('places a task right after its visible neighbour even when the column is filtered', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    const a = await t.task(project.id, { title: 'A' });
    await t.task(project.id, { title: 'Nascosta' });
    const c = await t.task(project.id, { title: 'C' });
    // Client only shows A and C; drops C right after A.
    await t.post(`/tasks/${c.id}/move`, { status: 'da_fare', prevId: a.id, nextId: null });
    expect(await column(project.id, 'da_fare')).toEqual(['A', 'C', 'Nascosta']);
  });

  it('renumbers the column when positions get too close', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    const a = await t.task(project.id, { title: 'A' });
    const b = await t.task(project.id, { title: 'B' });
    const moving = [await t.task(project.id, { title: 'X1' }), await t.task(project.id, { title: 'X2' })];
    let renumbered = false;
    // Repeatedly inserting between A and the task right after it halves the gap each time.
    for (let i = 0; i < 60; i++) {
      const task = moving[i % 2]!;
      const res = await t.post<MoveTaskResult>(`/tasks/${task.id}/move`, { status: 'da_fare', prevId: a.id });
      expect(res.status).toBe(200);
      renumbered ||= res.body.renumbered;
    }
    expect(renumbered).toBe(true);
    const order = await column(project.id, 'da_fare');
    expect(order[0]).toBe('A');
    expect(order[order.length - 1]).toBe('B');
    expect(b.id).toBeGreaterThan(0);
  });

  it('rejects neighbours from another column', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    const a = await t.task(project.id, { title: 'A', status: 'in_corso' });
    const b = await t.task(project.id, { title: 'B' });
    const res = await t.post(`/tasks/${b.id}/move`, { status: 'da_fare', prevId: a.id });
    expect(res.status).toBe(400);
  });
});

describe('comments', () => {
  it('adds, edits and deletes comments, keeping the author name', async () => {
    const author = await t.member({ name: 'Sara Colombo' });
    const project = await t.project(author.id);
    const task = await t.task(project.id);

    const created = await t.post<Comment>(`/tasks/${task.id}/comments`, { body: '  Ho iniziato  ', authorId: author.id });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ body: 'Ho iniziato', authorName: 'Sara Colombo', authorDeleted: false });

    expect((await t.get<Task>(`/tasks/${task.id}`)).body.commentCount).toBe(1);

    const edited = await t.patch<Comment>(`/comments/${created.body.id}`, { body: 'Quasi finito' });
    expect(edited.body.body).toBe('Quasi finito');

    expect((await t.post(`/tasks/${task.id}/comments`, { body: '', authorId: author.id })).status).toBe(400);
    expect((await t.post(`/tasks/${task.id}/comments`, { body: 'X', authorId: 999 })).body.error.field).toBe('authorId');

    expect((await t.del(`/comments/${created.body.id}`)).status).toBe(204);
    expect((await t.get<Comment[]>(`/tasks/${task.id}/comments`)).body).toEqual([]);
  });
});
