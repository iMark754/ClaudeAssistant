import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { migrate } from './migrations';

export type SqlParams = Record<string, SQLInputValue> | SQLInputValue[];

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Thin wrapper around node:sqlite with a prepared-statement cache and
 * nestable transactions (savepoints). All calls are synchronous.
 */
export class Database {
  readonly raw: DatabaseSync;
  private readonly statements = new Map<string, StatementSync>();
  private txDepth = 0;
  private closed = false;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
    if (path !== ':memory:') {
      this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    }
  }

  private prepare(sql: string): StatementSync {
    let stmt = this.statements.get(sql);
    if (!stmt) {
      stmt = this.raw.prepare(sql);
      this.statements.set(sql, stmt);
    }
    return stmt;
  }

  all<T>(sql: string, params?: SqlParams): T[] {
    const stmt = this.prepare(sql);
    if (params === undefined) return stmt.all() as T[];
    return (Array.isArray(params) ? stmt.all(...params) : stmt.all(params)) as T[];
  }

  get<T>(sql: string, params?: SqlParams): T | undefined {
    const stmt = this.prepare(sql);
    if (params === undefined) return stmt.get() as T | undefined;
    return (Array.isArray(params) ? stmt.get(...params) : stmt.get(params)) as T | undefined;
  }

  run(sql: string, params?: SqlParams): RunResult {
    const stmt = this.prepare(sql);
    const result = params === undefined ? stmt.run() : Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /** Runs `fn` atomically. Nested calls use savepoints. `fn` must be synchronous. */
  transaction<T>(fn: () => T): T {
    const savepoint = `sp_${this.txDepth}`;
    this.raw.exec(this.txDepth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    this.txDepth++;
    try {
      const result = fn();
      if (result instanceof Promise) throw new Error('Le transazioni devono essere sincrone');
      this.txDepth--;
      this.raw.exec(this.txDepth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.txDepth--;
      this.raw.exec(this.txDepth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.statements.clear();
    this.raw.close();
  }
}

/** Opens (creating if needed) and migrates the database. */
export function openDatabase(path: string): Database {
  const db = new Database(path);
  migrate(db);
  return db;
}
