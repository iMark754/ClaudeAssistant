import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DashboardData, TaskWithProject } from '@gp/shared';
import { createTestContext, type TestContext } from './helpers';

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext();
});
afterEach(async () => {
  await t.close();
});

describe('dashboard', () => {
  it('summarizes active projects, overdue, due-soon tasks and workload', async () => {
    const giulia = await t.member({ name: 'Giulia' });
    const luca = await t.member({ name: 'Luca' });
    const active = await t.project(giulia.id, { name: 'Attivo' });
    const paused = await t.project(giulia.id, { name: 'In pausa', status: 'in_pausa' });
    const archived = await t.project(giulia.id, { name: 'Archiviato' });

    await t.task(active.id, { title: 'In ritardo', dueDate: '2026-11-01', assigneeId: luca.id, estimateHours: 4 });
    await t.task(active.id, { title: 'Oggi', dueDate: '2026-11-08', assigneeId: luca.id, status: 'in_corso', estimateHours: 2.5 });
    await t.task(active.id, { title: 'Tra 7 giorni', dueDate: '2026-11-15', assigneeId: giulia.id });
    await t.task(active.id, { title: 'Tra 8 giorni', dueDate: '2026-11-16' });
    await t.task(active.id, { title: 'Fatta in ritardo', dueDate: '2026-11-01', status: 'fatto' });
    await t.task(paused.id, { title: 'Pausa in ritardo', dueDate: '2026-11-05', status: 'in_revisione' });
    await t.task(archived.id, { title: 'Archiviata in ritardo', dueDate: '2026-11-02', assigneeId: luca.id });
    await t.patch(`/projects/${archived.id}`, { version: 1, status: 'archiviato' });

    const res = await t.get<DashboardData>('/dashboard');
    const d = res.body;
    expect(d.today).toBe('2026-11-08');
    expect(d.activeProjects.map((p) => p.name)).toEqual(['Attivo']);
    expect(d.overdue.items.map((x) => x.title)).toEqual(['In ritardo', 'Pausa in ritardo']);
    expect(d.dueSoon.items.map((x) => x.title)).toEqual(['Oggi', 'Tra 7 giorni']);
    expect(d.kpis).toEqual({ activeProjects: 1, openTasks: 5, overdueTasks: 2, dueSoonTasks: 2 });

    const lucaRow = d.workload.find((w) => w.memberId === luca.id)!;
    expect(lucaRow).toMatchObject({ openCount: 2, estimateHours: 6.5, overdueCount: 1, byStatus: { da_fare: 1, in_corso: 1, in_revisione: 0 } });
    expect(d.workload[0]!.memberId).toBe(luca.id);
    const unassigned = d.workload[d.workload.length - 1]!;
    expect(unassigned).toMatchObject({ memberId: null, name: 'Non assegnate', openCount: 2 });
  });

  it('uses the Rome calendar day to decide what is overdue', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    await t.task(project.id, { title: 'Scade l’8', dueDate: '2026-11-08' });
    // 23:30 UTC on 8 Nov is already 9 Nov in Rome.
    t.clock.set('2026-11-08T23:30:00.000Z');
    const res = await t.get<DashboardData>('/dashboard');
    expect(res.body.today).toBe('2026-11-09');
    expect(res.body.overdue.total).toBe(1);
  });
});

describe('my tasks', () => {
  it('lists open tasks of a member across non-archived projects, by due date then priority', async () => {
    const me = await t.member({ name: 'Io' });
    const p1 = await t.project(me.id, { name: 'P1' });
    const p2 = await t.project(me.id, { name: 'P2' });
    const old = await t.project(me.id, { name: 'Vecchio' });
    await t.task(p1.id, { title: 'Senza scadenza', assigneeId: me.id });
    await t.task(p2.id, { title: 'Dopo', dueDate: '2026-11-20', assigneeId: me.id });
    await t.task(p1.id, { title: 'Prima bassa', dueDate: '2026-11-10', priority: 'bassa', assigneeId: me.id });
    await t.task(p2.id, { title: 'Prima urgente', dueDate: '2026-11-10', priority: 'urgente', assigneeId: me.id });
    await t.task(p1.id, { title: 'Fatta', status: 'fatto', assigneeId: me.id });
    await t.task(p1.id, { title: 'Di altri' });
    await t.task(old.id, { title: 'Archiviata', assigneeId: me.id });
    await t.patch(`/projects/${old.id}`, { version: 1, status: 'archiviato' });

    const res = await t.get<TaskWithProject[]>(`/members/${me.id}/open-tasks`);
    expect(res.body.map((x) => x.title)).toEqual(['Prima urgente', 'Prima bassa', 'Dopo', 'Senza scadenza']);
    expect(res.body[0]).toMatchObject({ projectName: 'P2', projectStatus: 'attivo' });
  });
});
