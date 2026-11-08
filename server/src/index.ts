import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/database';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const app = await buildApp({
  db,
  backupDir: config.backupDir,
  clientDist: config.clientDist,
  logger: { level: config.logLevel },
});

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EADDRINUSE') {
    console.error(`\n  La porta ${config.port} è già in uso. Chiudi l'altra applicazione o imposta la variabile PORT.\n`);
  } else {
    console.error(error);
  }
  db.close();
  process.exit(1);
}

const shownHost = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
console.log(`\n  Gestione Progetti in ascolto su http://${shownHost}:${config.port}`);
console.log(`  Database: ${config.dbPath}`);
if (!config.clientDist) {
  console.log('  Frontend non compilato: in sviluppo apri http://localhost:5173 (npm run dev).');
}
if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
  console.log('  Attenzione: il server è raggiungibile dalla rete e non richiede autenticazione.');
}
console.log('');

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await app.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
