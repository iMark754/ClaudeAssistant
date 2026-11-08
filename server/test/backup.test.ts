import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BackupValidationReport, MemberWithStats, RestoreResult } from '@gp/shared';
import { createTestContext, type TestContext } from './helpers';

const contexts: TestContext[] = [];
const dirs: string[] = [];

async function context(backupDir: string | null = null) {
  const ctx = await createTestContext({ backupDir });
  contexts.push(ctx);
  return ctx;
}

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function populate(t: TestContext) {
  const giulia = await t.member({ name: 'Giulia', email: 'giulia@example.com' });
  const luca = await t.member({ name: 'Luca', email: 'luca@example.com' });
  const project = await t.project(giulia.id, { name: 'Sito "nuovo"; v2' });
  const task = await t.task(project.id, { title: 'Prima', assigneeId: luca.id, dueDate: '2026-11-20', estimateHours: 1.5 });
  await t.task(project.id, { title: 'Seconda', status: 'fatto' });
  await t.post(`/tasks/${task.id}/comments`, { body: 'Commento', authorId: luca.id });
  return { giulia, luca, project, task };
}

async function download(t: TestContext) {
  const res = await t.get('/backup');
  expect(res.status).toBe(200);
  expect(String(res.headers['content-disposition'])).toMatch(/attachment; filename="backup-gestione-progetti-.*\.json"/);
  return JSON.parse(res.text);
}

describe('backup', () => {
  it('exports everything and restores it identically into an empty instance', async () => {
    const source = await context();
    await populate(source);
    const file = await download(source);
    expect(file).toMatchObject({ app: 'gestione-progetti', formatVersion: 1 });
    expect(file.data.members).toHaveLength(2);
    expect(file.data.tasks).toHaveLength(2);

    const target = await context();
    await target.member({ name: 'Da sovrascrivere' });
    const report = await target.post<BackupValidationReport>('/backup/validate', file);
    expect(report.body).toMatchObject({
      valid: true,
      errors: [],
      file: { counts: { members: 2, projects: 1, tasks: 2, comments: 1 }, formatVersion: 1 },
      current: { members: 1, projects: 0, tasks: 0, comments: 0 },
    });

    const restored = await target.post<RestoreResult>('/backup/restore', file);
    expect(restored.status).toBe(200);
    expect(restored.body.restored).toEqual({ members: 2, projects: 1, tasks: 2, comments: 1 });

    const again = await download(target);
    expect(again.data).toEqual(file.data);

    // New records continue after the restored identifiers.
    const created = await target.member({ email: 'nuovo@example.com' });
    expect(created.id).toBeGreaterThan(Math.max(...file.data.members.map((m: { id: number }) => m.id)));
  });

  it('reports structural problems without touching the data', async () => {
    const t = await context();
    await populate(t);
    const file = await download(t);
    file.data.tasks[0].status = 'quasi_fatto';
    file.data.members[1].email = 'non-una-email';
    delete file.data.projects[0].name;
    file.data.tasks[1].assigneeId = 999;

    const report = await t.post<BackupValidationReport>('/backup/validate', file);
    expect(report.body.valid).toBe(false);
    const paths = report.body.errors.map((e) => e.path);
    // Structural and referential problems are reported together, in a single pass.
    expect(paths).toEqual(
      expect.arrayContaining(['data.tasks[0].status', 'data.members[1].email', 'data.projects[0].name', 'data.tasks[1].assigneeId']),
    );
    // Items that failed validation still count as existing: no false "does not exist" errors.
    expect(report.body.errors.some((e) => e.path === 'data.tasks[0].projectId')).toBe(false);

    const restore = await t.post('/backup/restore', file);
    expect(restore.status).toBe(422);
    expect(restore.body.error.code).toBe('BACKUP_INVALID');
    expect((await t.get<MemberWithStats[]>('/members')).body).toHaveLength(2);
  });

  it('detects broken references, duplicates and violated business rules', async () => {
    const t = await context();
    const { luca } = await populate(t);
    const file = await download(t);
    file.data.tasks[0].assigneeId = 999;
    file.data.comments[0].taskId = 12345;
    file.data.members[1].email = file.data.members[0].email.toUpperCase();
    file.data.tasks[1].id = file.data.tasks[0].id;
    file.data.projects[0].dueDate = '2026-11-10';
    file.data.projects[0].status = 'completato';

    const report = await t.post<BackupValidationReport>('/backup/validate', file);
    const messages = report.body.errors.map((e) => `${e.path}: ${e.message}`);
    expect(messages.join('\n')).toMatch(/assigneeId: L'assegnatario \(membro 999\) non esiste/);
    expect(messages.join('\n')).toMatch(/comments\[0\]\.taskId/);
    expect(messages.join('\n')).toMatch(/usata da più membri/);
    expect(messages.join('\n')).toMatch(/duplicato/);
    expect(messages.join('\n')).toMatch(/supera quella del progetto/);
    expect(messages.join('\n')).toMatch(/è completato ma l'attività non è fatta/);
    expect(luca.id).toBeGreaterThan(0);
  });

  it('rejects files that are not backups of this app', async () => {
    const t = await context();
    for (const payload of [[1, 2, 3], { app: 'altro', data: {} }, { app: 'gestione-progetti', formatVersion: 99 }]) {
      const res = await t.post<BackupValidationReport>('/backup/validate', payload);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    }
    const invalidJson = await t.app.inject({
      method: 'POST',
      url: '/api/backup/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{ non json',
    });
    expect(invalidJson.statusCode).toBe(400);
  });

  it('takes a safety snapshot before restoring', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gp-backup-'));
    dirs.push(dir);
    const t = await context(dir);
    await populate(t);
    const file = await download(t);
    file.data.comments = [];

    const res = await t.post<RestoreResult>('/backup/restore', file);
    expect(res.body.snapshot).toMatch(/^pre-ripristino-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    const files = readdirSync(dir);
    expect(files).toEqual([res.body.snapshot]);
    const snapshot = JSON.parse(readFileSync(join(dir, files[0]!), 'utf8'));
    expect(snapshot.data.comments).toHaveLength(1);
  });

  it('caps the number of reported errors', async () => {
    const t = await context();
    await populate(t);
    const file = await download(t);
    const template = file.data.tasks[0];
    file.data.tasks = Array.from({ length: 300 }, (_, i) => ({ ...template, id: i + 1, status: 'boh' }));
    const report = await t.post<BackupValidationReport>('/backup/validate', file);
    expect(report.body.errors).toHaveLength(100);
    expect(report.body.truncated).toBe(true);
  });
});
