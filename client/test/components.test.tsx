import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Project, TaskSummary } from '@gp/shared';
import { EMPTY_TASK_FILTERS } from '@gp/shared';
import { EmptyState, ErrorState } from '../src/components/ui/Feedback';
import { BackupPage } from '../src/features/backup/BackupPage';
import { TaskFilterBar } from '../src/features/project/TaskFilterBar';
import { ProjectStatusMenu } from '../src/features/projects/ProjectStatus';
import { TaskFormDialog } from '../src/features/task-detail/TaskFormDialog';
import { applyOptimisticMove } from '../src/lib/positions';
import { mockApi, renderWithProviders } from './utils';
import { FolderKanban } from 'lucide-react';

const project: Project = {
  id: 1,
  name: 'Sito web',
  description: '',
  status: 'attivo',
  startDate: '2026-11-01',
  dueDate: '2026-11-30',
  ownerId: 1,
  ownerName: 'Giulia Romano',
  version: 3,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  taskCount: 2,
  doneCount: 0,
  openCount: 2,
  overdueCount: 0,
  progress: 0,
};

const members = [
  { id: 1, name: 'Giulia Romano', email: 'g@example.com', role: 'PM', createdAt: '', updatedAt: '', openTaskCount: 0, ownedProjectCount: 1 },
];

describe('ProjectStatusMenu', () => {
  it('explains why a project with open tasks cannot be completed', async () => {
    const patch = vi.fn(() => ({
      status: 409,
      body: {
        error: {
          code: 'PROJECT_HAS_OPEN_TASKS',
          message: 'Il progetto non può essere completato perché ci sono ancora 2 attività non fatte (1 da fare, 1 in corso).',
          details: {
            openCount: 2,
            byStatus: { da_fare: 1, in_corso: 1, in_revisione: 0 },
            tasks: [
              { id: 10, title: 'Testi della home', status: 'in_corso' },
              { id: 11, title: 'Cookie banner', status: 'da_fare' },
            ],
          },
        },
      },
    }));
    mockApi({ 'GET /api/members': () => ({ body: members }), 'PATCH /api/projects/1': patch });
    const user = userEvent.setup();
    renderWithProviders(<ProjectStatusMenu project={project} />);

    await user.click(screen.getByRole('button', { name: /Stato del progetto: Attivo/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Segna come completato' }));

    const dialog = await screen.findByRole('dialog', { name: 'Il progetto non può essere completato' });
    expect(dialog).toHaveTextContent('ci sono ancora 2 attività non fatte');
    expect(dialog).toHaveTextContent('Testi della home');
    expect(dialog).toHaveTextContent('Cookie banner');
    expect(screen.getByRole('button', { name: 'Mostra le attività aperte' })).toBeInTheDocument();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((patch.mock.calls[0] as unknown as [RequestInit])[0].body))).toEqual({ version: 3, status: 'completato' });
  });

  it('asks for confirmation before archiving', async () => {
    mockApi({ 'GET /api/members': () => ({ body: members }) });
    const user = userEvent.setup();
    renderWithProviders(<ProjectStatusMenu project={project} />);
    await user.click(screen.getByRole('button', { name: /Stato del progetto/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archivia' }));
    expect(await screen.findByRole('dialog', { name: 'Archiviare il progetto?' })).toHaveTextContent('sola lettura');
  });
});

describe('TaskFormDialog', () => {
  it('blocks a due date after the project due date without calling the API', async () => {
    const create = vi.fn(() => ({ status: 201, body: {} }));
    mockApi({ 'GET /api/members': () => ({ body: members }), 'POST /api/projects/1/tasks': create });
    const user = userEvent.setup();
    renderWithProviders(<TaskFormDialog project={project} initialStatus="da_fare" onClose={() => {}} onCreated={() => {}} />);

    await user.type(screen.getByLabelText(/Titolo/), 'Pubblicazione');
    fireEvent.change(screen.getByLabelText('Scadenza'), { target: { value: '2026-12-05' } });
    await user.click(screen.getByRole('button', { name: 'Crea attività' }));

    expect(await screen.findByText('La scadenza non può superare quella del progetto (30 nov 2026)')).toBeInTheDocument();
    expect(screen.getByLabelText('Scadenza')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Scadenza')).toHaveAttribute('max', '2026-11-30');
    expect(create).not.toHaveBeenCalled();
  });

  it('sends a valid task, accepting a decimal comma for the estimate', async () => {
    const create = vi.fn((init?: RequestInit) => ({ status: 201, body: { id: 99, ...JSON.parse(String(init?.body)) } }));
    mockApi({ 'GET /api/members': () => ({ body: members }), 'POST /api/projects/1/tasks': create });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TaskFormDialog project={project} initialStatus="in_corso" onClose={onClose} onCreated={() => {}} />);

    await user.type(screen.getByLabelText(/Titolo/), '  Revisione testi ');
    await user.type(screen.getByLabelText('Stima (ore)'), '2,5');
    await user.click(screen.getByRole('button', { name: 'Crea attività' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((create.mock.calls[0] as unknown as [RequestInit])[0].body));
    expect(body).toMatchObject({ title: 'Revisione testi', status: 'in_corso', priority: 'media', estimateHours: 2.5, dueDate: null, assigneeId: null });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('TaskFilterBar', () => {
  it('toggles the overdue filter and resets filters', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TaskFilterBar filters={EMPTY_TASK_FILTERS} onChange={onChange} members={members} showStatus shown={10} total={10} />,
    );
    const toggle = screen.getByRole('button', { name: 'Solo in ritardo' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Azzera filtri' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_TASK_FILTERS, overdue: true });

    rerender(<TaskFilterBar filters={{ ...EMPTY_TASK_FILTERS, overdue: true }} onChange={onChange} members={members} showStatus shown={3} total={10} />);
    expect(screen.getByText('3 di 10 attività')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Azzera filtri' }));
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_TASK_FILTERS);
  });
});

describe('BackupPage', () => {
  it('rejects a file that is not JSON before contacting the server', async () => {
    const validate = vi.fn(() => ({ body: {} }));
    mockApi({ 'GET /api/members': () => ({ body: [] }), 'POST /api/backup/validate': validate });
    const user = userEvent.setup();
    renderWithProviders(<BackupPage />);
    await user.upload(screen.getByLabelText(/Scegli un file di backup/), new File(['non sono json'], 'appunti.json', { type: 'application/json' }));
    expect(await screen.findByText(/Il file non è in formato JSON/)).toBeInTheDocument();
    expect(validate).not.toHaveBeenCalled();
  });

  it('shows the content summary of a valid backup before restoring', async () => {
    mockApi({
      'GET /api/members': () => ({ body: [] }),
      'POST /api/backup/validate': () => ({
        body: {
          valid: true,
          errors: [],
          truncated: false,
          file: { exportedAt: '2026-11-08T16:45:00.000Z', formatVersion: 1, counts: { members: 6, projects: 3, tasks: 42, comments: 10 } },
          current: { members: 7, projects: 6, tasks: 58, comments: 34 },
        },
      }),
    });
    const user = userEvent.setup();
    renderWithProviders(<BackupPage />);
    await user.upload(screen.getByLabelText(/Scegli un file di backup/), new File(['{"app":"gestione-progetti"}'], 'backup.json', { type: 'application/json' }));
    expect(await screen.findByText(/è un backup valido/)).toBeInTheDocument();
    expect(screen.getByText(/Creato il 8 nov 2026.*17:45/)).toBeInTheDocument();
    const tasksRow = screen.getByRole('row', { name: /Attività/ });
    expect(tasksRow).toHaveTextContent('42');
    expect(tasksRow).toHaveTextContent('58');
    await user.click(screen.getByRole('button', { name: 'Ripristina questi dati' }));
    const confirm = await screen.findByRole('dialog', { name: 'Sostituire tutti i dati?' });
    expect(confirm).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ripristina' })).toBeDisabled();
    await user.type(screen.getByLabelText(/Per confermare scrivi/), 'ripristina');
    expect(screen.getByRole('button', { name: 'Ripristina' })).toBeEnabled();
  });
});

describe('feedback components', () => {
  it('renders empty and error states with their actions', async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <EmptyState icon={FolderKanban} title="Nessun progetto" description="Crea il primo" action={<button type="button">Crea</button>} />
        <ErrorState message="Server non raggiungibile" onRetry={retry} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Nessun progetto' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Server non raggiungibile');
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('applyOptimisticMove', () => {
  const t = (id: number, status: TaskSummary['status'], position: number) =>
    ({ id, projectId: 1, status, position, completedAt: null }) as TaskSummary;

  it('places the task between its neighbours like the server', () => {
    const tasks = [t(1, 'da_fare', 1024), t(2, 'da_fare', 2048), t(3, 'in_corso', 1024)];
    const moved = applyOptimisticMove(tasks, { taskId: 3, status: 'da_fare', prevId: 1, nextId: 2 });
    expect(moved.find((x) => x.id === 3)).toMatchObject({ status: 'da_fare', position: 1536 });
    const top = applyOptimisticMove(tasks, { taskId: 2, status: 'da_fare', prevId: null, nextId: 1 });
    expect(top.find((x) => x.id === 2)!.position).toBe(0);
    const done = applyOptimisticMove(tasks, { taskId: 1, status: 'fatto', prevId: null, nextId: null });
    expect(done.find((x) => x.id === 1)).toMatchObject({ status: 'fatto', position: 1024 });
    expect(done.find((x) => x.id === 1)!.completedAt).not.toBeNull();
  });
});
