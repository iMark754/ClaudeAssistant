import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Comment, MemberImpact, MemberWithStats, Project, Task } from '@gp/shared';
import { createTestContext, type TestContext } from './helpers';

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext();
});
afterEach(async () => {
  await t.close();
});

describe('members', () => {
  it('creates members with unique, case-insensitive emails', async () => {
    const giulia = await t.member({ name: 'Giulia', email: 'Giulia@Example.com' });
    expect(giulia.email).toBe('giulia@example.com');

    const dup = await t.post('/members', { name: 'Altra', email: 'GIULIA@example.com', role: 'PM' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: 'EMAIL_TAKEN', field: 'email' });

    const luca = await t.member({ name: 'Luca', email: 'luca@example.com' });
    const clash = await t.patch(`/members/${luca.id}`, { email: 'giulia@example.com' });
    expect(clash.body.error.code).toBe('EMAIL_TAKEN');
    // Keeping one's own email is fine.
    expect((await t.patch(`/members/${luca.id}`, { email: 'LUCA@example.com', role: 'Dev' })).status).toBe(200);
  });

  it('lists members sorted by name with open task counts', async () => {
    const zeno = await t.member({ name: 'Zeno' });
    const anna = await t.member({ name: 'Anna' });
    const project = await t.project(anna.id);
    await t.task(project.id, { assigneeId: zeno.id });
    await t.task(project.id, { assigneeId: zeno.id, status: 'fatto' });
    const res = await t.get<MemberWithStats[]>('/members');
    expect(res.body.map((m) => m.name)).toEqual(['Anna', 'Zeno']);
    expect(res.body[0]).toMatchObject({ ownedProjectCount: 1, openTaskCount: 0 });
    expect(res.body[1]).toMatchObject({ ownedProjectCount: 0, openTaskCount: 1 });
  });

  it('unassigns tasks (also in archived projects) and keeps comments when deleting a member', async () => {
    const owner = await t.member({ name: 'Responsabile' });
    const leaving = await t.member({ name: 'Marco Ferrari' });
    const project = await t.project(owner.id);
    const archivedProject = await t.project(owner.id, { name: 'Vecchio' });
    const task = await t.task(project.id, { assigneeId: leaving.id });
    const oldTask = await t.task(archivedProject.id, { assigneeId: leaving.id });
    await t.post(`/tasks/${task.id}/comments`, { body: 'Lascio note', authorId: leaving.id });
    await t.patch(`/projects/${archivedProject.id}`, { version: 1, status: 'archiviato' });

    const impact = await t.get<MemberImpact>(`/members/${leaving.id}/impact`);
    expect(impact.body).toMatchObject({ assignedTaskCount: 2, openTaskCount: 2, commentCount: 1, ownedProjects: [] });

    expect((await t.del(`/members/${leaving.id}`)).status).toBe(204);

    const after = await t.get<Task>(`/tasks/${task.id}`);
    expect(after.body).toMatchObject({ assigneeId: null, assigneeName: null, version: 2 });
    expect((await t.get<Task>(`/tasks/${oldTask.id}`)).body.assigneeId).toBeNull();

    const comments = await t.get<Comment[]>(`/tasks/${task.id}/comments`);
    expect(comments.body[0]).toMatchObject({ authorId: null, authorName: 'Marco Ferrari', authorDeleted: true });
  });

  it('requires reassigning owned projects before deleting their owner', async () => {
    const owner = await t.member({ name: 'Chiara' });
    const other = await t.member({ name: 'Davide' });
    const project = await t.project(owner.id, { name: 'Campagna' });
    await t.patch(`/projects/${project.id}`, { version: 1, status: 'archiviato' });

    const blocked = await t.del(`/members/${owner.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('MEMBER_OWNS_PROJECTS');
    expect(blocked.body.error.details.projects).toEqual([{ id: project.id, name: 'Campagna' }]);

    expect((await t.del(`/members/${owner.id}?reassignOwnerTo=${owner.id}`)).status).toBe(400);
    expect((await t.del(`/members/${owner.id}?reassignOwnerTo=999`)).status).toBe(422);

    expect((await t.del(`/members/${owner.id}?reassignOwnerTo=${other.id}`)).status).toBe(204);
    const reassigned = await t.get<Project>(`/projects/${project.id}`);
    expect(reassigned.body).toMatchObject({ ownerId: other.id, ownerName: 'Davide', status: 'archiviato' });
  });

  it('returns 404 for unknown members', async () => {
    expect((await t.del('/members/999')).status).toBe(404);
    expect((await t.get('/members/abc/impact')).status).toBe(404);
  });
});
