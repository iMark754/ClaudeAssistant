import type { Database } from './database';

/**
 * Ordered list of schema migrations. The index + 1 is the schema version stored
 * in `PRAGMA user_version`. Never edit an existing migration: append a new one.
 */
const MIGRATIONS: readonly string[] = [
  /* 1: initial schema */ `
  CREATE TABLE members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL COLLATE NOCASE UNIQUE,
    role        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL CHECK (status IN ('attivo', 'in_pausa', 'completato', 'archiviato')),
    start_date  TEXT NOT NULL,
    due_date    TEXT,
    owner_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    CHECK (due_date IS NULL OR due_date >= start_date)
  );
  CREATE INDEX idx_projects_status ON projects(status);
  CREATE INDEX idx_projects_owner ON projects(owner_id);

  CREATE TABLE tasks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL CHECK (status IN ('da_fare', 'in_corso', 'in_revisione', 'fatto')),
    priority       TEXT NOT NULL CHECK (priority IN ('bassa', 'media', 'alta', 'urgente')),
    assignee_id    INTEGER REFERENCES members(id) ON DELETE SET NULL,
    due_date       TEXT,
    estimate_hours REAL CHECK (estimate_hours IS NULL OR estimate_hours > 0),
    position       REAL NOT NULL,
    completed_at   TEXT,
    version        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
  CREATE INDEX idx_tasks_project_status_position ON tasks(project_id, status, position);
  CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_id, status);
  CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

  CREATE TABLE comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id   INTEGER REFERENCES members(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX idx_comments_task ON comments(task_id, created_at);
  CREATE INDEX idx_comments_author ON comments(author_id);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db: Database): void {
  const current = db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Il database è stato creato da una versione più recente dell'applicazione (schema ${current}, supportato ${SCHEMA_VERSION}).`,
    );
  }
  for (let version = current; version < SCHEMA_VERSION; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]!);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
