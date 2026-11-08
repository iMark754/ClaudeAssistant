import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { CurrentMemberProvider } from '../src/lib/currentMember';

type Handler = (init: RequestInit | undefined, url: string) => { status?: number; body?: unknown };

/** Stubs fetch with handlers keyed by "METHOD /path" (query string ignored). */
export function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.split('?')[0]!.replace(/^https?:\/\/[^/]+/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = handlers[key];
    if (!handler) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Nessun mock per ${key}` } }), { status: 404, headers: { 'content-type': 'application/json' } });
    const { status = 200, body } = handler(init, url);
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(body ?? null), { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [route] });
  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <CurrentMemberProvider>
          <RouterProvider router={router} />
        </CurrentMemberProvider>
      </QueryClientProvider>,
    ),
  };
}
