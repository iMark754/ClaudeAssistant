# Gestione Progetti

Applicazione web per gestire i progetti di un piccolo team (5-20 persone): progetti, attività con vista kanban e lista, commenti, dashboard, "Le mie attività", esportazione CSV e backup/ripristino.

Gira interamente in locale: un server Node.js espone le API, salva i dati in un file SQLite e serve l'interfaccia. Non servono servizi esterni, chiavi API, Docker né un database da installare.

## Prerequisiti

- **Node.js 22.13 o successivo** (consigliato Node 24 LTS), con `npm`. È l'unico requisito.
- Un browser recente (Chrome, Edge, Firefox, Safari).

Il database usa il modulo `node:sqlite` incluso in Node: non si compila nulla di nativo durante l'installazione.

## Avvio rapido

```bash
npm install        # installa le dipendenze di tutti i pacchetti
npm run seed       # crea il database e carica i dati di esempio
npm start          # compila e avvia l'applicazione
```

Poi apri **http://localhost:3000** e scegli chi sei dal selettore in alto a destra.

`npm start` ricompila client e server a ogni avvio (circa 10 secondi). Per riavviare senza ricompilare: `npm run start -w server`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm start` | Compila e avvia l'app su http://localhost:3000 |
| `npm run dev` | Sviluppo: API con ricaricamento automatico su :3000 e interfaccia Vite su **http://localhost:5173** |
| `npm run seed` | Sostituisce i dati con quelli di esempio (prima salva una copia dei dati esistenti in `data/backups/`) |
| `npm run seed -- --large` | Dati di esempio più 20 progetti con 150 attività ciascuno (~3000 attività), per provare le prestazioni |
| `npm test` | Esegue tutti i test automatici (shared, server, client) |
| `npm run typecheck` | Controllo dei tipi TypeScript su tutti i pacchetti |
| `npm run lint` | ESLint su tutto il repository |
| `npm run build` | Compila client (`client/dist`) e server (`server/dist`) |

### Configurazione

Variabili d'ambiente facoltative:

| Variabile | Predefinito | Descrizione |
|---|---|---|
| `PORT` | `3000` | Porta del server |
| `HOST` | `127.0.0.1` | Interfaccia di ascolto. Con `0.0.0.0` l'app diventa raggiungibile dagli altri PC della rete (vedi *Limiti noti*) |
| `DB_PATH` | `data/app.db` | File del database (percorso relativo alla radice del progetto o assoluto) |
| `BACKUP_DIR` | `data/backups` | Cartella delle copie di sicurezza automatiche |
| `LOG_LEVEL` | `warn` | Livello di log del server (`info` per vedere ogni richiesta) |

Esempio per condividere l'app in rete locale:

```bash
# bash / macOS / Linux
HOST=0.0.0.0 PORT=8080 npm start
```

```powershell
# PowerShell
$env:HOST = "0.0.0.0"; $env:PORT = "8080"; npm start
```

## Funzionalità

- **Dashboard**: progetti attivi con avanzamento, attività in ritardo, attività in scadenza nei prossimi 7 giorni, carico di lavoro per membro (attività aperte per stato, ore stimate, ritardi).
- **Progetti**:
  - ricerca su nome e descrizione (ignora maiuscole e accenti), filtro per stato, ordinamento per scadenza, avanzamento, nome o data di creazione;
  - creazione, modifica, cambio di stato ed eliminazione.
- **Kanban** per progetto:
  - drag and drop tra le colonne e dentro la colonna, con mouse, touch e tastiera (Spazio per prendere, frecce per spostare, Spazio per rilasciare);
  - ogni scheda ha anche un menu "Sposta in…" e su/giù, in alternativa al trascinamento;
  - l'ordine resta salvato.
- **Lista** delle attività:
  - filtri per assegnatario (anche "Non assegnate"), priorità, stato, solo in ritardo, ricerca;
  - colonne ordinabili, righe virtualizzate per restare fluida con migliaia di attività;
  - filtri e ordinamento stanno nell'URL, quindi un link condiviso riapre la stessa vista.
- **Dettaglio attività** in un pannello laterale, apribile anche tramite link (`?attivita=ID`): modifica dei campi e commenti. I propri commenti si possono modificare o eliminare.
- **Le mie attività**: le attività aperte del membro corrente in tutti i progetti, raggruppate (in ritardo, oggi, prossimi 7 giorni, più avanti, senza scadenza) e ordinate per scadenza e priorità. Lo stato si cambia direttamente dall'elenco, con "Annulla".
- **Membri**: creazione, modifica ed eliminazione. Prima di eliminare un membro viene mostrato l'impatto (attività che torneranno non assegnate, commenti, progetti da riassegnare).
- **Esportazione CSV** delle attività di un progetto, rispettando filtri e ordinamento della vista corrente.
- **Backup e ripristino**:
  - si scarica un unico file JSON;
  - il ripristino controlla prima il contenuto del file e mostra un riepilogo, oppure l'elenco completo dei problemi trovati;
  - chiede una conferma esplicita e salva una copia dei dati attuali prima di sovrascriverli.

### Dati di esempio

`npm run seed` carica uno studio fittizio, «Studio Aurora». Le date sono relative al giorno in cui si esegue il comando, così ci sono sempre attività in ritardo e in scadenza:

- 7 membri con ruoli diversi;
- 6 progetti: 3 attivi (uno senza scadenza), 1 in pausa, 1 completato, 1 archiviato;
- 58 attività con stati, priorità, assegnatari e stime varie, alcune non assegnate: 6 in ritardo e 8 in scadenza nei prossimi 7 giorni;
- 34 commenti.

## Struttura del progetto

```
├── shared/                 Codice comune a client e server (TypeScript)
│   └── src/
│       ├── enums.ts        Stati, priorità ed etichette in italiano
│       ├── schemas.ts      Schemi di validazione zod (stessi messaggi su client e server)
│       ├── dates.ts        Date in Europe/Rome, formattazione, "oggi", ritardi
│       ├── taskFilters.ts  Filtri e ordinamenti delle attività (vista lista ed export CSV)
│       └── types.ts        Tipi dei dati scambiati dalle API
├── server/
│   ├── src/
│   │   ├── index.ts        Avvio del server
│   │   ├── app.ts          Applicazione Fastify (errori, file statici, fallback SPA)
│   │   ├── config.ts       Variabili d'ambiente e percorsi
│   │   ├── db/             Connessione SQLite, transazioni, migrazioni
│   │   ├── repositories/   Query SQL
│   │   ├── services/       Regole di business, CSV, backup
│   │   ├── routes/         Endpoint REST sotto /api
│   │   └── seed/           Dati di esempio
│   └── test/               Test di integrazione delle API (SQLite in memoria)
├── client/
│   ├── src/
│   │   ├── api/            Client HTTP e hook TanStack Query
│   │   ├── components/     Componenti riutilizzabili (pulsanti, dialog, badge, form…)
│   │   ├── features/       Pagine: dashboard, progetti, kanban, lista, dettaglio, membri, backup…
│   │   ├── layout/         Struttura della pagina, navigazione, selettore del membro corrente
│   │   └── lib/            Membro corrente, hook, utilità
│   └── test/               Test dei componenti (Testing Library)
└── data/                   Database e backup automatici (creata al primo avvio, esclusa da git)
```

### API principali

Tutte sotto `/api`, in JSON. Gli errori hanno sempre la forma `{ "error": { "code", "message", "field?", "fieldErrors?", "details?" } }` con messaggi in italiano.

| Metodo e percorso | Descrizione |
|---|---|
| `GET/POST /members`, `PATCH/DELETE /members/:id` | Membri (`DELETE ?reassignOwnerTo=ID` se è responsabile di progetti) |
| `GET /members/:id/impact` | Conseguenze dell'eliminazione di un membro |
| `GET /members/:id/open-tasks` | Attività aperte del membro ("Le mie attività") |
| `GET /projects?q&status&sort&dir` | Elenco progetti con avanzamento e conteggi per stato |
| `POST /projects`, `GET/PATCH/DELETE /projects/:id` | Progetti |
| `GET/POST /projects/:id/tasks` | Attività del progetto |
| `GET /projects/:id/tasks.csv` | Esportazione CSV (accetta gli stessi filtri della lista) |
| `GET/PATCH/DELETE /tasks/:id` | Attività |
| `POST /tasks/:id/move` | Spostamento kanban `{ status, prevId?, nextId? }` |
| `GET/POST /tasks/:id/comments`, `PATCH/DELETE /comments/:id` | Commenti |
| `GET /dashboard` | Dati della dashboard |
| `GET /backup`, `POST /backup/validate`, `POST /backup/restore` | Backup e ripristino |

## Scelte fatte

**Stack.** TypeScript end-to-end, in un monorepo con npm workspaces.
- **Backend**: Fastify 5.
- **Frontend**: React 19 con Vite, React Router, TanStack Query, Tailwind CSS 4, Radix UI (dialog e menu accessibili), dnd-kit (drag and drop accessibile da tastiera e touch) e TanStack Virtual.
- **Codice condiviso**: il pacchetto `shared` contiene schemi di validazione, etichette, gestione delle date e filtri. Così client e server applicano le stesse regole e mostrano gli stessi messaggi.

**Database: SQLite tramite `node:sqlite`.** È incluso in Node ≥ 22.13: niente compilazione nativa (che richiederebbe strumenti di build su Windows) e niente servizi da installare.
- Il database è un unico file, in modalità WAL e con chiavi esterne attive.
- Lo schema è versionato con migrazioni (`PRAGMA user_version`).
- L'SQL è scritto a mano con query preparate e aggregazioni lato database: avanzamento, conteggi e carico di lavoro sono calcolati con un'unica query ciascuno.

**Date e fuso orario.**
- Le scadenze sono date di calendario (`AAAA-MM-GG`) e non subiscono mai spostamenti di fuso.
- Gli istanti (creazione, modifica, commenti) sono salvati in UTC e mostrati in **Europe/Rome**.
- "Oggi", e quindi ritardi e scadenze imminenti, si calcola sempre nel fuso di Roma, indipendentemente dal fuso del computer. I test coprono la mezzanotte e i cambi dell'ora legale.

**Regole di business**, applicate dal server e rispecchiate dall'interfaccia:
- **Progetto archiviato = sola lettura.**
  - Sono rifiutate modifiche al progetto e a tutte le sue attività e commenti (creazione, modifica, spostamento, eliminazione).
  - L'unica azione permessa è il ripristino, cioè il ritorno a uno stato non archiviato. Anche l'eliminazione richiede di ripristinarlo prima.
  - Restano possibili consultazione ed esportazione CSV.
- **Completamento.**
  - Un progetto non può passare a "Completato" finché ha attività non fatte. L'utente vede un dialog con il numero di attività aperte per stato, l'elenco e un collegamento alla lista già filtrata.
  - Per coerenza, in un progetto completato non si possono creare attività non fatte né riaprirne una: bisogna prima riportare il progetto in stato "Attivo".
- **Eliminazione di un membro.**
  - Le sue attività tornano non assegnate, anche nei progetti archiviati: l'integrità dei dati prevale sulla sola lettura.
  - I suoi commenti restano visibili con il suo nome, contrassegnati come "ex membro".
  - Se è responsabile di progetti, prima di eliminarlo bisogna scegliere un nuovo responsabile, perché ogni progetto ne deve avere uno.
- **Scadenze.**
  - La scadenza di un'attività non può superare quella del progetto.
  - Per lo stesso motivo non si può anticipare la scadenza di un progetto prima di quella delle sue attività: l'errore elenca le attività in conflitto.
  - La scadenza di un progetto non può precedere la data di inizio.
- **Email** dei membri univoche, senza distinzione tra maiuscole e minuscole.

**Modifiche concorrenti.** Progetti e attività hanno un numero di versione: se due persone modificano la stessa attività, la seconda riceve un avviso invece di sovrascrivere in silenzio. Ha sempre la possibilità di ricaricare.

**Ordine del kanban.**
- Ogni attività ha una posizione decimale. Spostando una scheda, il server la colloca subito dopo la scheda che la precede (o prima di quella che la segue). Funziona anche quando la colonna è filtrata e alcune schede sono nascoste.
- Quando lo spazio tra due posizioni diventa troppo piccolo, la colonna viene rinumerata nella stessa transazione.
- L'interfaccia aggiorna subito la bacheca e annulla lo spostamento se il server lo rifiuta.

**Filtri.** Le attività di un progetto vengono caricate una volta e filtrate nel browser, quindi i filtri sono istantanei anche con migliaia di righe. La stessa funzione di filtro, condivisa, è usata dal server per l'esportazione CSV: «esporta» produce esattamente ciò che si vede.

**CSV.**
- UTF-8 con BOM, separatore `;`, fine riga CRLF, date `gg/mm/aaaa` e decimali con la virgola: si apre correttamente in Excel con impostazioni italiane.
- Le celle che iniziano con `=`, `+`, `-` o `@` sono neutralizzate contro la *formula injection*.

**Backup.**
- Il file JSON ha un identificativo dell'app e una versione del formato.
- Il ripristino valida ogni elemento: struttura, campi, riferimenti tra membri, progetti, attività e commenti, email e identificativi duplicati, regole di business. Riporta tutti i problemi in un'unica passata.
- Sostituisce i dati in un'unica transazione: se qualcosa va storto non cambia nulla.
- Prima di sovrascrivere salva automaticamente una copia in `data/backups/`.

**Membro corrente.** Non c'è autenticazione, come richiesto: il membro scelto dal selettore nell'intestazione viene ricordato nel browser (localStorage) e serve a personalizzare "Le mie attività", la dashboard e l'autore dei commenti.

**Accessibilità di base.**
- HTML semantico, etichette su tutti i campi, errori collegati ai campi (`aria-describedby`, `aria-invalid`).
- Focus visibile, link "Vai al contenuto", dialog con focus trap (Radix).
- Kanban utilizzabile da tastiera, con annunci in italiano per i lettori di schermo e un menu alternativo al trascinamento.
- Notifiche in regione live, contrasti adeguati, rispetto di `prefers-reduced-motion`.

**Responsive.** Sotto i 1024 px la navigazione diventa un menu a scomparsa. Il kanban scorre orizzontalmente con aggancio alle colonne. Il trascinamento su touch si attiva con una breve pressione, per non interferire con lo scorrimento.

**Prestazioni.** Misurate con `npm run seed -- --large` (3058 attività):
- le API principali rispondono in 4-16 ms;
- con 3000 attività in un solo progetto, la lista virtualizzata tiene nel DOM circa 50 righe alla volta;
- il kanban mostra 50 schede per colonna con "Mostra altre", e le schede sono memoizzate.

## Test

```bash
npm test
```

72 test (Vitest):

- **shared**: date (fuso di Roma, mezzanotte, ora legale), formattazione, schemi di validazione, filtri e ordinamenti.
- **server**: test di integrazione delle API su SQLite in memoria, con orologio controllato:
  - CRUD;
  - sola lettura degli archiviati su tutte le operazioni;
  - blocco del completamento con dettagli;
  - eliminazione di un membro con riassegnazione e attività non assegnate;
  - vincoli sulle scadenze;
  - versioni concorrenti;
  - spostamenti kanban e rinumerazione;
  - dashboard e "Le mie attività";
  - CSV (escaping, BOM, filtri, formule);
  - backup (andata e ritorno, file corrotti, riferimenti rotti, atomicità, copia di sicurezza).
- **client**: componenti con Testing Library:
  - dialog di completamento bloccato;
  - conferma dell'archiviazione;
  - validazione del form attività;
  - filtri;
  - controllo del file di backup prima del ripristino;
  - stati vuoto ed errore;
  - aggiornamento ottimistico del kanban.

## Limiti noti

- **Nessuna autenticazione né permessi.** Chiunque raggiunga il server può leggere e modificare tutto. Per questo il server ascolta solo su `127.0.0.1`. Se lo si espone in rete con `HOST=0.0.0.0`, va fatto solo su una rete fidata.
- **Nessun aggiornamento in tempo reale.** Le modifiche degli altri compaiono quando si torna sulla finestra o si cambia pagina. Il controllo di versione evita comunque le sovrascritture silenziose. Lo spostamento delle schede nel kanban non usa il controllo di versione: vince l'ultimo spostamento.
- **`node:sqlite` è segnalato come sperimentale** in Node 22/24. L'avviso viene nascosto negli script; l'API usata è minima e coperta dai test.
- **Un solo processo e un solo file di database.** Pensato per un team piccolo, non per più istanze del server.
- **L'avanzamento** è calcolato sul numero di attività fatte, non sulle ore stimate.
- **Dashboard e "Le mie attività" escludono i progetti archiviati**, perché in sola lettura. Le liste della dashboard mostrano al massimo 50 elementi, con il totale indicato.
- **Kanban e filtri.** Le colonne molto lunghe sono paginate ("Mostra altre"). Si può trascinare solo tra le schede visibili.
- **Commenti.** Modifica ed eliminazione sono offerte solo per i propri commenti, ma senza autenticazione è una convenzione dell'interfaccia, non una protezione.
- **Bundle.** Il bundle JavaScript del client è unico (circa 240 KB compressi): irrilevante in locale, ma non ottimizzato per reti lente.
