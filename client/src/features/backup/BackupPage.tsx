import { CheckCircle2, Download, FileJson, FileWarning, Upload } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { formatDateTime, type BackupValidationReport, type EntityCounts, type RestoreResult } from '@gp/shared';
import { errorMessage } from '../../api/client';
import { useRestoreBackup, useValidateBackup } from '../../api/queries';
import { Button, buttonClass } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Callout, Spinner } from '../../components/ui/Feedback';
import { PageHeader, SectionCard } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../lib/hooks';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const COUNT_LABELS: { key: keyof EntityCounts; label: string }[] = [
  { key: 'members', label: 'Membri' },
  { key: 'projects', label: 'Progetti' },
  { key: 'tasks', label: 'Attività' },
  { key: 'comments', label: 'Commenti' },
];

type State =
  | { step: 'idle' }
  | { step: 'reading'; fileName: string }
  | { step: 'checked'; fileName: string; payload: unknown; report: BackupValidationReport }
  | { step: 'error'; fileName: string; message: string }
  | { step: 'done'; result: RestoreResult };

function CountsTable({ report }: { report: BackupValidationReport }) {
  return (
    <table className="w-full max-w-md text-sm">
      <caption className="sr-only">Confronto tra il contenuto del file e i dati attuali</caption>
      <thead>
        <tr className="text-left text-xs text-slate-500 uppercase">
          <th scope="col" className="py-1.5 font-semibold">Elemento</th>
          <th scope="col" className="py-1.5 text-right font-semibold">Nel file</th>
          <th scope="col" className="py-1.5 text-right font-semibold">Attuali</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {COUNT_LABELS.map(({ key, label }) => (
          <tr key={key}>
            <th scope="row" className="py-1.5 text-left font-medium text-slate-700">{label}</th>
            <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">{report.file.counts?.[key] ?? '—'}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-600">{report.current[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BackupPage() {
  useDocumentTitle('Backup e ripristino');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: 'idle' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const validateBackup = useValidateBackup();
  const restore = useRestoreBackup();

  const reset = () => {
    setState({ step: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setState({ step: 'error', fileName: file.name, message: 'Il file supera la dimensione massima di 50 MB.' });
      return;
    }
    setState({ step: 'reading', fileName: file.name });
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setState({ step: 'error', fileName: file.name, message: 'Il file non è in formato JSON: scegli un file di backup esportato da questa applicazione.' });
      return;
    }
    validateBackup.mutate(payload, {
      onSuccess: (report) => setState({ step: 'checked', fileName: file.name, payload, report }),
      onError: (error) => setState({ step: 'error', fileName: file.name, message: errorMessage(error) }),
    });
  };

  const onRestore = () => {
    if (state.step !== 'checked') return;
    restore.mutate(state.payload, {
      onSuccess: (result) => {
        setConfirmOpen(false);
        setState({ step: 'done', result });
        if (inputRef.current) inputRef.current.value = '';
        toast.success('Dati ripristinati dal backup');
      },
      onError: (error) => {
        setConfirmOpen(false);
        toast.error(errorMessage(error));
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Backup e ripristino" description="Salva tutti i dati in un file o ripristinali da un backup precedente." />

      <div className="space-y-6">
        <SectionCard title="Esporta i dati" description="Un unico file JSON con membri, progetti, attività e commenti.">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Conserva il file in un luogo sicuro: potrai usarlo per ripristinare i dati su questo o su un altro computer.</p>
            <a href="/api/backup" download className={buttonClass('primary', 'md', 'shrink-0')}>
              <Download className="size-4" aria-hidden="true" />
              Scarica backup
            </a>
          </div>
        </SectionCard>

        <SectionCard title="Ripristina da file" description="Il contenuto del file viene controllato prima di sostituire i dati.">
          <div className="space-y-5 px-5 py-5">
            <Callout tone="warning" title="Il ripristino sostituisce tutti i dati attuali">
              Prima di sovrascrivere, il server salva automaticamente una copia dei dati attuali nella cartella <code className="font-mono text-xs">data/backups</code>.
            </Callout>

            <div>
              <input ref={inputRef} id={inputId} type="file" accept=".json,application/json" className="peer sr-only" onChange={onFile} />
              <label
                htmlFor={inputId}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600"
              >
                <Upload className="size-6 text-slate-500" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-800">Scegli un file di backup (.json)</span>
                <span className="text-xs text-slate-500">Massimo 50 MB</span>
              </label>
            </div>

            <div aria-live="polite">
              {(state.step === 'reading' || validateBackup.isPending) && (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Spinner className="size-4" /> Controllo del file in corso…
                </p>
              )}

              {state.step === 'error' && (
                <Callout tone="danger" icon={FileWarning} title={`Impossibile usare «${state.fileName}»`} action={<Button size="sm" onClick={reset}>Scegli un altro file</Button>}>
                  {state.message}
                </Callout>
              )}

              {state.step === 'checked' && state.report.valid && (
                <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                    «{state.fileName}» è un backup valido
                  </p>
                  {state.report.file.exportedAt && (
                    <p className="text-sm text-slate-700">Creato il {formatDateTime(state.report.file.exportedAt)}.</p>
                  )}
                  <CountsTable report={state.report} />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                      Ripristina questi dati
                    </Button>
                    <Button onClick={reset}>Annulla</Button>
                  </div>
                </div>
              )}

              {state.step === 'checked' && !state.report.valid && (
                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                    <FileWarning className="size-5" aria-hidden="true" />
                    «{state.fileName}» non può essere ripristinato
                  </p>
                  <p className="text-sm text-red-900">
                    {state.report.errors.length === 1 && !state.report.truncated
                      ? 'È stato trovato 1 problema.'
                      : `Sono stati trovati ${state.report.truncated ? 'più di ' : ''}${state.report.errors.length} problemi.`}{' '}
                    Nessun dato è stato modificato.
                  </p>
                  <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg bg-white p-3 text-sm">
                    {state.report.errors.map((e, i) => (
                      <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                        <code className="shrink-0 font-mono text-xs text-slate-500">{e.path}</code>
                        <span className="text-slate-800">{e.message}</span>
                      </li>
                    ))}
                  </ul>
                  {state.report.truncated && <p className="text-xs text-red-800">Sono mostrati solo i primi {state.report.errors.length} problemi.</p>}
                  <Button size="sm" onClick={reset}>
                    Scegli un altro file
                  </Button>
                </div>
              )}

              {state.step === 'done' && (
                <Callout
                  tone="success"
                  icon={FileJson}
                  title="Ripristino completato"
                  action={
                    <Button size="sm" onClick={reset}>
                      Fatto
                    </Button>
                  }
                >
                  Ripristinati {state.result.restored.members} membri, {state.result.restored.projects} progetti, {state.result.restored.tasks} attività e{' '}
                  {state.result.restored.comments} commenti.
                  {state.result.snapshot && (
                    <>
                      {' '}
                      I dati precedenti sono stati salvati in <code className="font-mono text-xs">data/backups/{state.result.snapshot}</code>.
                    </>
                  )}
                </Callout>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sostituire tutti i dati?"
        description={
          state.step === 'checked' ? (
            <>
              I dati attuali ({state.report.current.projects} progetti, {state.report.current.tasks} attività) verranno sostituiti con quelli del file (
              {state.report.file.counts?.projects ?? 0} progetti, {state.report.file.counts?.tasks ?? 0} attività).
            </>
          ) : null
        }
        confirmLabel="Ripristina"
        requireText="RIPRISTINA"
        loading={restore.isPending}
        onConfirm={onRestore}
      />
    </div>
  );
}
