/**
 * Loads the demo data, replacing the current content of the database.
 * Existing data is first saved to data/backups/pre-seed-<timestamp>.json.
 *
 *   npm run seed              # 7 members, 6 projects, ~58 tasks, ~34 comments
 *   npm run seed -- --large   # adds 20 projects with 150 tasks each (performance check)
 */
import { join, relative } from 'node:path';
import { addDays, isTaskOverdue, todayInRome } from '@gp/shared';
import { systemClock } from '../clock';
import { loadConfig, REPO_ROOT } from '../config';
import { openDatabase } from '../db/database';
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, replaceAllData, validateBackup, writeSnapshot } from '../services/backup';
import { buildDemoData } from './demoData';

const large = process.argv.includes('--large');
const config = loadConfig();
const db = openDatabase(config.dbPath);
const ctx = { db, clock: systemClock, backupDir: config.backupDir };

try {
  const now = systemClock.now();
  const today = todayInRome(now);
  const data = buildDemoData({ today, now, large });

  // The demo data goes through the same validation as a restored backup.
  const { report } = validateBackup(db, {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    data,
  });
  if (!report.valid) {
    console.error('I dati di esempio non sono validi:');
    for (const error of report.errors) console.error(`  - ${error.path}: ${error.message}`);
    process.exitCode = 1;
  } else {
    const snapshot = writeSnapshot(ctx, config.backupDir, 'pre-seed');
    replaceAllData(db, data);

    const archived = new Set(data.projects.filter((p) => p.status === 'archiviato').map((p) => p.id));
    const live = data.tasks.filter((task) => !archived.has(task.projectId));
    const overdue = live.filter((task) => isTaskOverdue(task, today)).length;
    const soonEnd = addDays(today, 7);
    const dueSoon = live.filter((task) => task.status !== 'fatto' && task.dueDate && task.dueDate >= today && task.dueDate <= soonEnd).length;

    console.log(`\n  Dati di esempio caricati in ${relative(REPO_ROOT, config.dbPath) || config.dbPath}`);
    console.log(
      `  ${data.members.length} membri · ${data.projects.length} progetti · ${data.tasks.length} attività · ${data.comments.length} commenti`,
    );
    console.log(`  In ritardo: ${overdue} · In scadenza nei prossimi 7 giorni: ${dueSoon}`);
    if (snapshot) console.log(`  I dati precedenti sono stati salvati in ${join(relative(REPO_ROOT, config.backupDir), snapshot)}`);
    console.log('\n  Avvia l\'applicazione con: npm start\n');
  }
} finally {
  db.close();
}
