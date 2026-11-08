import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UTF8_BOM, escapeCsvCell } from '../src/services/csv';
import { createTestContext, type TestContext } from './helpers';

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext();
});
afterEach(async () => {
  await t.close();
});

describe('CSV export', () => {
  it('escapes cells and neutralizes formulas', () => {
    expect(escapeCsvCell('semplice')).toBe('semplice');
    expect(escapeCsvCell('con; separatore')).toBe('"con; separatore"');
    expect(escapeCsvCell('con "virgolette"')).toBe('"con ""virgolette"""');
    expect(escapeCsvCell('riga 1\nriga 2')).toBe('"riga 1\nriga 2"');
    expect(escapeCsvCell('=SOMMA(A1:A2)')).toBe("'=SOMMA(A1:A2)");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('exports the tasks of a project with Italian formatting', async () => {
    const owner = await t.member({ name: 'Giulia Romano', email: 'giulia@example.com' });
    const project = await t.project(owner.id, { name: 'Sito Web: Fase 2!' });
    await t.task(project.id, {
      title: 'Testi; "home"',
      description: '=HYPERLINK("x")',
      assigneeId: owner.id,
      dueDate: '2026-11-05',
      estimateHours: 2.5,
      priority: 'alta',
      status: 'in_corso',
    });
    await t.task(project.id, { title: 'Fatta', status: 'fatto' });

    const res = await t.get(`/projects/${project.id}/tasks.csv`);
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'])).toContain('text/csv');
    expect(String(res.headers['content-disposition'])).toBe('attachment; filename="attivita-sito-web-fase-2-2026-11-08.csv"');
    expect(res.text.startsWith(UTF8_BOM)).toBe(true);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);

    const lines = res.text.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      'ID;Titolo;Descrizione;Stato;Priorità;Assegnatario;Email assegnatario;Scadenza;Stima (ore);In ritardo;Commenti;Creata il;Aggiornata il;Completata il',
    );
    expect(lines[1]).toMatch(
      /^\d+;"Testi; ""home""";"'=HYPERLINK\(""x""\)";In corso;Alta;Giulia Romano;giulia@example\.com;05\/11\/2026;2,5;Sì;0;08\/11\/2026 11:00;08\/11\/2026 11:00;$/,
    );
    expect(lines[2]).toContain(';Fatta;');
  });

  it('honours the list filters', async () => {
    const owner = await t.member();
    const project = await t.project(owner.id);
    await t.task(project.id, { title: 'Urgente', priority: 'urgente' });
    await t.task(project.id, { title: 'Bassa', priority: 'bassa' });
    const res = await t.get(`/projects/${project.id}/tasks.csv?priorita=urgente`);
    const lines = res.text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Urgente');
  });
});

describe('API basics', () => {
  it('answers health checks and unknown routes with JSON', async () => {
    expect((await t.get('/health')).body).toMatchObject({ status: 'ok', schemaVersion: 1 });
    const missing = await t.get('/non-esiste');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 on malformed JSON and sets security headers', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/members',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
