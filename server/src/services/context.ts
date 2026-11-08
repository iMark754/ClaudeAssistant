import type { Clock } from '../clock';
import type { Database } from '../db/database';
import { archivedError } from '../errors';
import type { ProjectRow } from '../repositories/projects';

export interface ServiceContext {
  db: Database;
  clock: Clock;
  /** Directory for automatic safety snapshots (null disables them, e.g. in tests). */
  backupDir: string | null;
}

/** Archived projects are read-only: any change to them or their content is rejected. */
export function assertProjectWritable(project: Pick<ProjectRow, 'status'>, message?: string): void {
  if (project.status === 'archiviato') throw archivedError(message);
}
