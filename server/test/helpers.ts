import type { FastifyInstance } from 'fastify';
import type { Member, Project, Task } from '@gp/shared';
import { buildApp } from '../src/app';
import { fixedClock } from '../src/clock';
import { openDatabase, type Database } from '../src/db/database';

export interface Response<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, unknown>;
  text: string;
}

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  clock: ReturnType<typeof fixedClock>;
  backupDir: string | null;
  get<T = any>(url: string): Promise<Response<T>>;
  post<T = any>(url: string, body?: unknown): Promise<Response<T>>;
  patch<T = any>(url: string, body?: unknown): Promise<Response<T>>;
  del<T = any>(url: string): Promise<Response<T>>;
  close(): Promise<void>;
  // Fixture helpers (they assert success).
  member(overrides?: Partial<{ name: string; email: string; role: string }>): Promise<Member>;
  project(ownerId: number, overrides?: Record<string, unknown>): Promise<Project>;
  task(projectId: number, overrides?: Record<string, unknown>): Promise<Task>;
}

/** Default "now": Sunday 8 Nov 2026, 11:00 in Rome. */
export const NOW = '2026-11-08T10:00:00.000Z';
export const TODAY = '2026-11-08';

let emailCounter = 0;

export async function createTestContext(options: { now?: string; backupDir?: string | null } = {}): Promise<TestContext> {
  const db = openDatabase(':memory:');
  const clock = fixedClock(options.now ?? NOW);
  const backupDir = options.backupDir ?? null;
  const app = await buildApp({ db, clock, backupDir });

  const request = async <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<Response<T>> => {
    const res = await app.inject({ method, url: `/api${url}`, ...(body !== undefined ? { payload: body as object } : {}) });
    let parsed: unknown = undefined;
    const type = String(res.headers['content-type'] ?? '');
    if (res.body && type.includes('application/json')) parsed = res.json();
    return { status: res.statusCode, body: parsed as T, headers: res.headers, text: res.body };
  };

  const ctx: TestContext = {
    app,
    db,
    clock,
    backupDir,
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body ?? {}),
    patch: (url, body) => request('PATCH', url, body ?? {}),
    del: (url) => request('DELETE', url),
    async close() {
      await app.close();
      db.close();
    },
    async member(overrides = {}) {
      emailCounter++;
      const res = await ctx.post<Member>('/members', {
        name: `Membro ${emailCounter}`,
        email: `membro${emailCounter}@example.com`,
        role: 'Sviluppatore',
        ...overrides,
      });
      if (res.status !== 201) throw new Error(`member: ${res.status} ${res.text}`);
      return res.body;
    },
    async project(ownerId, overrides = {}) {
      const res = await ctx.post<Project>('/projects', {
        name: 'Progetto di prova',
        startDate: '2026-11-01',
        dueDate: '2026-12-31',
        ownerId,
        ...overrides,
      });
      if (res.status !== 201) throw new Error(`project: ${res.status} ${res.text}`);
      return res.body;
    },
    async task(projectId, overrides = {}) {
      const res = await ctx.post<Task>(`/projects/${projectId}/tasks`, { title: 'Attività di prova', ...overrides });
      if (res.status !== 201) throw new Error(`task: ${res.status} ${res.text}`);
      return res.body;
    },
  };
  return ctx;
}
