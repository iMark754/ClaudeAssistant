/**
 * Realistic demo data. All dates are relative to "today" in Europe/Rome, so the
 * dataset always contains overdue tasks and tasks due in the next days.
 */
import { addDays, type ProjectStatus, type TaskPriority, type TaskStatus } from '@gp/shared';
import type { BackupData } from '../services/backup';

type Offset = number | null;

interface TaskSpec {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Member index (1-based) or null when unassigned. */
  assignee: number | null;
  due: Offset;
  estimate: number | null;
  description?: string;
}

interface ProjectSpec {
  name: string;
  description: string;
  status: ProjectStatus;
  start: number;
  due: Offset;
  owner: number;
  tasks: TaskSpec[];
}

/** [project index, task index, author index, hours ago, body] (indices are 1-based) */
type CommentSpec = [number, number, number, number, string];

const DOMAIN = 'studioaurora.example';

const MEMBERS: [string, string][] = [
  ['Giulia Romano', 'Project manager'],
  ['Luca Bianchi', 'Sviluppatore backend'],
  ['Sara Colombo', 'Designer UX/UI'],
  ['Matteo Ferrari', 'Sviluppatore frontend'],
  ['Elena Ricci', 'QA / Tester'],
  ['Davide Esposito', 'DevOps'],
  ['Chiara Marino', 'Marketing'],
];

const t = (
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  assignee: number | null,
  due: Offset,
  estimate: number | null,
  description?: string,
): TaskSpec => ({ title, status, priority, assignee, due, estimate, description });

const PROJECTS: ProjectSpec[] = [
  {
    name: 'Nuovo sito istituzionale',
    description:
      'Rifacimento completo del sito aziendale: nuova architettura dei contenuti, design responsive, integrazione con il CRM e migrazione dei contenuti esistenti.',
    status: 'attivo',
    start: -45,
    due: 21,
    owner: 1,
    tasks: [
      t('Workshop requisiti con il cliente', 'fatto', 'media', 1, -38, 6),
      t('Mappa del sito e architettura dei contenuti', 'fatto', 'alta', 3, -30, 8),
      t('Wireframe delle pagine principali', 'fatto', 'alta', 3, -22, 16),
      t('Design system: colori, tipografia e componenti', 'fatto', 'alta', 3, -14, 20),
      t('Setup del progetto frontend e pipeline di build', 'fatto', 'media', 4, -25, 6),
      t('Sviluppo template home page', 'in_revisione', 'alta', 4, -2, 12,
        'Home page con hero, servizi in evidenza, ultime news e call to action verso il modulo contatti.'),
      t('Revisione testi pagina "Chi siamo"', 'in_revisione', 'media', 7, -4, 3),
      t('Integrazione modulo contatti con il CRM', 'in_corso', 'urgente', 2, -1, 10,
        'I lead inviati dal modulo devono arrivare nel CRM con origine "sito web" e consenso privacy tracciato.'),
      t('Pagine servizi: sviluppo componenti', 'in_corso', 'alta', 4, 5, 14),
      t('Ottimizzazione immagini e lazy loading', 'da_fare', 'media', 4, 6, 4),
      t('Test cross-browser e su dispositivi mobili', 'da_fare', 'alta', 5, 12, 10,
        'Browser da coprire: Chrome, Firefox, Safari, Edge. Dispositivi: iPhone, Android di fascia media, iPad.'),
      t('Configurazione hosting e certificati HTTPS', 'da_fare', 'alta', 6, 3, 5),
      t('Redirect 301 dalle vecchie URL', 'da_fare', 'media', null, 14, 3),
      t('Cookie banner e informativa privacy', 'da_fare', 'urgente', null, 7, 4),
      t('Checklist SEO di lancio', 'da_fare', 'bassa', 7, 18, null),
      t('Analytics e obiettivi di conversione', 'da_fare', 'bassa', null, null, 3),
    ],
  },
  {
    name: 'App mobile prenotazioni',
    description:
      'App iOS e Android per prenotare appuntamenti nelle sedi, con promemoria e pagamento anticipato con carta.',
    status: 'attivo',
    start: -30,
    due: 75,
    owner: 4,
    tasks: [
      t('Ricerca utenti: interviste e personas', 'fatto', 'alta', 3, -20, 12),
      t('Flussi di prenotazione (user flow)', 'fatto', 'alta', 3, -12, 10),
      t('Scelta del framework mobile e prototipo tecnico', 'fatto', 'media', 4, -15, 8),
      t('API disponibilità sedi e slot orari', 'in_corso', 'alta', 2, 4, 16),
      t('Schermata calendario e selezione dello slot', 'in_corso', 'alta', 4, 10, 18),
      t('Autenticazione con email e codice OTP', 'in_revisione', 'urgente', 2, -3, 10),
      t('Mockup ad alta fedeltà', 'in_revisione', 'media', 3, 2, 14),
      t('Integrazione pagamenti con carta', 'da_fare', 'alta', 2, 30, 20),
      t('Notifiche push di promemoria', 'da_fare', 'media', 6, 35, 8),
      t('Piano di test e casi di test', 'da_fare', 'media', 5, 20, 6),
      t('Accessibilità: contrasti e lettori di schermo', 'da_fare', 'media', 5, 40, 8),
      t('Testi delle schermate e microcopy', 'da_fare', 'bassa', 7, 25, 4),
      t('Pubblicazione su App Store e Google Play', 'da_fare', 'alta', null, 70, 6),
      t('Gestione cancellazioni e rimborsi', 'da_fare', 'media', null, null, null),
    ],
  },
  {
    name: 'Migrazione infrastruttura cloud',
    description:
      "Spostamento dei servizi interni dal server in sede a un provider cloud europeo. In pausa in attesa dell'approvazione del budget.",
    status: 'in_pausa',
    start: -60,
    due: 40,
    owner: 6,
    tasks: [
      t('Inventario dei servizi e delle dipendenze', 'fatto', 'alta', 6, -50, 8),
      t('Confronto delle offerte dei provider', 'fatto', 'media', 6, -40, 6),
      t('Stima dei costi mensili', 'fatto', 'alta', 1, -35, 4),
      t('Piano di backup e disaster recovery', 'in_corso', 'urgente', 6, -6, 12),
      t('Containerizzazione del gestionale interno', 'in_corso', 'alta', 2, 10, 24),
      t('Migrazione database con fermo minimo', 'da_fare', 'alta', 2, 25, 16),
      t('Monitoraggio e alert', 'da_fare', 'media', 6, 30, 8),
      t('Documentazione operativa per il team', 'da_fare', 'bassa', null, -9, 6),
      t('Test di carico dopo la migrazione', 'da_fare', 'media', 5, 38, 10),
    ],
  },
  {
    name: 'Campagna lancio autunno',
    description: 'Campagna multicanale per il lancio dei nuovi servizi: newsletter, social e landing page dedicata.',
    status: 'completato',
    start: -90,
    due: -10,
    owner: 7,
    tasks: [
      t('Brief creativo e messaggi chiave', 'fatto', 'alta', 7, -80, 6),
      t('Calendario editoriale social', 'fatto', 'media', 7, -70, 4),
      t('Landing page della campagna', 'fatto', 'alta', 4, -55, 12),
      t('Grafiche per social e newsletter', 'fatto', 'media', 3, -50, 10),
      t('Configurazione invio newsletter', 'fatto', 'media', 6, -40, 3),
      t('Report risultati della campagna', 'fatto', 'media', 7, -12, 5),
      t('Retrospettiva con il team', 'fatto', 'bassa', 1, -10, 2),
    ],
  },
  {
    name: 'Portale fornitori v1',
    description:
      'Prima versione del portale per la gestione degli ordini dei fornitori. Archiviato: sostituito dal nuovo gestionale.',
    status: 'archiviato',
    start: -240,
    due: -150,
    owner: 2,
    tasks: [
      t('Analisi dei processi di acquisto', 'fatto', 'alta', 1, -220, 10),
      t('Accesso fornitori', 'fatto', 'alta', 2, -200, 12),
      t('Caricamento listini da CSV', 'fatto', 'media', 2, -180, 8),
      t('Dashboard ordini', 'fatto', 'media', 4, -165, 16),
      t('Esportazione fatture', 'in_corso', 'media', 2, -155, 8),
      t('Notifiche email ai fornitori', 'da_fare', 'bassa', null, -150, 4),
    ],
  },
  {
    name: 'Formazione e onboarding interno',
    description: 'Percorso di inserimento per i nuovi colleghi e sessioni di formazione sugli strumenti del team.',
    status: 'attivo',
    start: -20,
    due: null,
    owner: 1,
    tasks: [
      t('Guida di benvenuto per i nuovi assunti', 'fatto', 'media', 1, -10, 6),
      t('Sessione: buone pratiche con Git', 'in_corso', 'media', 2, 1, 3),
      t("Sessione: accessibilità nel design", 'da_fare', 'media', 3, 9, 3),
      t('Checklist account e strumenti', 'in_revisione', 'alta', 6, 0, 2),
      t('Glossario dei termini di progetto', 'da_fare', 'bassa', null, null, 2),
      t('Raccolta feedback dopo 30 giorni', 'da_fare', 'bassa', 5, null, null),
    ],
  },
];

const COMMENTS: CommentSpec[] = [
  [1, 3, 1, 600, 'Approvati dal cliente con piccole modifiche al menu principale.'],
  [1, 6, 4, 50, 'Ho caricato la prima versione in staging, manca solo la sezione news.'],
  [1, 6, 3, 30, 'Ottimo lavoro! Il carosello va allineato alla griglia: margini a 24px come da design system.'],
  [1, 6, 4, 6, 'Sistemato il carosello, pronto per la revisione finale.'],
  [1, 7, 7, 100, "Bozza pronta nel documento condiviso, aspetto l'ok della direzione."],
  [1, 7, 1, 28, 'La direzione chiede di accorciare la parte sulla storia aziendale. Riesci entro domani?'],
  [1, 8, 2, 72, 'Le API del CRM hanno un limite di 60 richieste al minuto: aggiungo una coda per gestire i picchi.'],
  [1, 8, 1, 48, 'Va bene, ma è urgente: il cliente vuole vedere arrivare i lead prima del lancio.'],
  [1, 8, 2, 20, 'Coda implementata. Resta da gestire il caso in cui il CRM non risponde.'],
  [1, 8, 5, 3, 'Quando è in staging avvisami, preparo i casi di test.'],
  [1, 9, 4, 26, 'Completati 3 componenti su 7.'],
  [1, 12, 6, 40, "Ho chiesto al provider l'attivazione del certificato wildcard."],
  [1, 14, 1, 52, "Chi si prende questa attività? Va chiusa prima del lancio."],
  [1, 14, 7, 10, "Posso occuparmi dei testi dell'informativa, ma non dello sviluppo."],
  [2, 4, 2, 30, 'Definito il contratto delle API, lo trovate nella cartella docs del repository.'],
  [2, 4, 4, 22, 'Mi servirebbe anche il nome della sede nella risposta.'],
  [2, 4, 2, 18, 'Aggiunto, grazie della segnalazione.'],
  [2, 5, 4, 12, 'Uso il componente calendario nativo, più accessibile con i lettori di schermo.'],
  [2, 6, 2, 80, 'Implementato invio del codice via email. Passo in revisione.'],
  [2, 6, 5, 30, 'Trovato un problema: il codice scade dopo 1 minuto invece di 10.'],
  [2, 6, 2, 5, 'Corretto, puoi ricontrollare?'],
  [2, 7, 3, 15, 'Caricati i mockup delle 12 schermate principali.'],
  [2, 7, 4, 8, 'Molto belli! Il pulsante di conferma nel riepilogo è troppo vicino al bordo per chi usa il pollice.'],
  [2, 13, 4, 90, 'Servono gli account sviluppatore aziendali: chi li gestisce?'],
  [3, 4, 6, 200, 'Bozza del piano pronta, manca la stima dei tempi di ripristino.'],
  [3, 4, 1, 150, "Progetto in pausa fino all'approvazione del budget: completiamo almeno questo documento."],
  [3, 8, 6, 300, 'Da assegnare quando il progetto riparte.'],
  [4, 6, 7, 280, 'Tasso di apertura della newsletter al 38%, sopra la media del settore.'],
  [4, 6, 1, 270, 'Ottimo risultato, condividiamolo alla prossima riunione di team.'],
  [5, 5, 2, 3700, 'Sospeso: il portale verrà sostituito dal nuovo gestionale.'],
  [6, 1, 5, 230, 'Letta: chiara e utile. Suggerisco di aggiungere i contatti di riferimento per ogni area.'],
  [6, 2, 2, 20, 'Slide pronte, sessione confermata per domani alle 10.'],
  [6, 2, 4, 16, 'Possiamo includere anche una parte su rebase e risoluzione dei conflitti?'],
  [6, 4, 6, 4, 'Checklist aggiornata con i nuovi strumenti, manca la revisione.'],
];

// ---------------------------------------------------------------------------

const romeParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO timestamp of a Rome wall-clock time. */
function romeTime(date: string, hour: number, minute = 0): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const parts = Object.fromEntries(romeParts.formatToParts(new Date(guess)).map((p) => [p.type, Number(p.value)]));
  const romeAsUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!);
  return new Date(guess - (romeAsUtc - guess)).toISOString();
}

const maxIso = (...values: (string | null)[]) => values.filter((v): v is string => v !== null).sort().pop()!;
const minIso = (a: string, b: string) => (a < b ? a : b);

/** Deterministic PRNG (mulberry32). */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    weighted: <T>(entries: readonly [T, number][]): T => {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let r = next() * total;
      for (const [value, weight] of entries) {
        r -= weight;
        if (r <= 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
  };
}

function largeProjects(random: ReturnType<typeof createRandom>, count: number, tasksPerProject: number): ProjectSpec[] {
  const clients = ['Ottica Venturi', 'Pasticceria Galli', 'Studio legale Conti', 'Hotel Belvedere', 'Cantina Moretti', 'Palestra Energia', 'Libreria Fontana', 'Officina Rinaldi', 'Farmacia Greco', 'Agriturismo Il Poggio'];
  const kinds = ['Sito vetrina', 'E-commerce', 'Gestionale ordini', 'App fedeltà', 'Portale clienti'];
  const verbs = ['Implementare', 'Rivedere', 'Testare', 'Documentare', 'Progettare', 'Ottimizzare', 'Configurare', 'Analizzare', 'Correggere', 'Aggiornare'];
  const objects = ['il modulo ordini', 'la pagina profilo', 'il report mensile', "l'API clienti", 'il carrello', 'le notifiche email', 'la ricerca prodotti', 'il pannello amministrativo', "l'esportazione dati", 'il calendario appuntamenti', 'i permessi utente', 'la pagina di checkout'];

  return Array.from({ length: count }, (_, i) => {
    const start = -random.int(10, 120);
    const due = random.int(30, 200);
    const tasks: TaskSpec[] = Array.from({ length: tasksPerProject }, (_, j) => {
      const hasDue = random.next() < 0.7;
      return {
        title: `${random.pick(verbs)} ${random.pick(objects)} (#${j + 1})`,
        status: random.weighted<TaskStatus>([['da_fare', 35], ['in_corso', 20], ['in_revisione', 10], ['fatto', 35]]),
        priority: random.weighted<TaskPriority>([['bassa', 25], ['media', 45], ['alta', 22], ['urgente', 8]]),
        assignee: random.next() < 0.15 ? null : random.int(1, MEMBERS.length),
        due: hasDue ? random.int(Math.max(start, -40), due) : null,
        estimate: random.next() < 0.7 ? random.int(1, 24) : null,
      };
    });
    return {
      name: `${random.pick(kinds)} – ${clients[i % clients.length]} ${Math.floor(i / clients.length) + 1}`,
      description: 'Progetto generato per verificare le prestazioni con molte attività.',
      status: random.next() < 0.8 ? 'attivo' : 'in_pausa',
      start,
      due,
      owner: random.int(1, MEMBERS.length),
      tasks,
    };
  });
}

export interface DemoOptions {
  today: string;
  now: Date;
  large?: boolean;
}

export function buildDemoData({ today, now, large = false }: DemoOptions): BackupData {
  const nowIso = now.toISOString();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const day = (offset: number) => addDays(today, offset);

  const projectSpecs = large ? [...PROJECTS, ...largeProjects(createRandom(20261108), 20, 150)] : PROJECTS;

  const data: BackupData = { members: [], projects: [], tasks: [], comments: [] };

  MEMBERS.forEach(([name, role], index) => {
    const createdAt = romeTime(day(-300 + index * 7), 9, 30);
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@${DOMAIN}`;
    data.members.push({ id: index + 1, name, email, role, createdAt, updatedAt: createdAt });
  });

  const taskIdByRef = new Map<string, number>();
  let taskId = 0;

  projectSpecs.forEach((spec, pIndex) => {
    const projectId = pIndex + 1;
    const createdAt = romeTime(day(spec.start - 1), 9, 0);
    data.projects.push({
      id: projectId,
      name: spec.name,
      description: spec.description,
      status: spec.status,
      startDate: day(spec.start),
      dueDate: spec.due === null ? null : day(spec.due),
      ownerId: spec.owner,
      version: 1,
      createdAt,
      updatedAt: minIso(romeTime(day(spec.start + 2), 18, 0), nowIso),
    });

    const positions = new Map<TaskStatus, number>();
    spec.tasks.forEach((task, tIndex) => {
      taskId++;
      taskIdByRef.set(`${pIndex + 1}:${tIndex + 1}`, taskId);
      const position = (positions.get(task.status) ?? 0) + 1024;
      positions.set(task.status, position);
      // Created during the first working days of the project (09:00-16:20).
      const taskCreated = new Date(Date.parse(createdAt) + Math.floor(tIndex / 12) * 86_400_000 + (tIndex % 12) * 40 * 60_000).toISOString();
      const completedAt =
        task.status === 'fatto'
          ? minIso(maxIso(task.due !== null ? romeTime(day(task.due), 16, 30) : null, taskCreated, romeTime(day(spec.start + 3), 17, 0)), nowIso)
          : null;
      data.tasks.push({
        id: taskId,
        projectId,
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        assigneeId: task.assignee,
        dueDate: task.due === null ? null : day(task.due),
        estimateHours: task.estimate,
        position,
        completedAt,
        version: 1,
        createdAt: taskCreated,
        updatedAt: maxIso(taskCreated, completedAt),
      });
    });
  });

  COMMENTS.forEach(([p, tIdx, author, hours, body], index) => {
    const id = taskIdByRef.get(`${p}:${tIdx}`);
    if (!id) throw new Error(`Commento di esempio riferito a un'attività inesistente: ${p}:${tIdx}`);
    const task = data.tasks[id - 1]!;
    const createdAt = maxIso(hoursAgo(hours), task.createdAt);
    data.comments.push({
      id: index + 1,
      taskId: id,
      authorId: author,
      authorName: MEMBERS[author - 1]![0],
      body,
      createdAt,
      updatedAt: createdAt,
    });
    task.updatedAt = maxIso(task.updatedAt, createdAt);
  });

  return data;
}
