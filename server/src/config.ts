import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root: this file lives in server/src (dev) or is bundled into server/dist (build). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function resolveFromRoot(value: string): string {
  return isAbsolute(value) ? value : resolve(REPO_ROOT, value);
}

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  backupDir: string;
  clientDist: string | null;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT non valida: ${env.PORT}`);
  }
  const dbPath = resolveFromRoot(env.DB_PATH ?? 'data/app.db');
  const clientDist = resolve(REPO_ROOT, 'client', 'dist');
  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    dbPath,
    backupDir: resolveFromRoot(env.BACKUP_DIR ?? resolve(dirname(dbPath), 'backups')),
    clientDist: existsSync(resolve(clientDist, 'index.html')) ? clientDist : null,
    logLevel: env.LOG_LEVEL ?? 'warn',
  };
}
