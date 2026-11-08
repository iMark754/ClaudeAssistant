import type { ApiErrorBody, ApiErrorPayload } from '@gp/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorPayload['code'];
  readonly field?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.field = payload.field;
    this.fieldErrors = payload.fieldErrors;
    this.details = payload.details;
  }
}

const NETWORK_ERROR_MESSAGE = 'Impossibile contattare il server. Verifica che l’applicazione sia in esecuzione e riprova.';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE });
  }

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const payload = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      payload ?? { code: 'INTERNAL_ERROR', message: `Errore del server (${response.status}). Riprova tra poco.` },
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

/** User-facing message for any error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Si è verificato un errore imprevisto.';
}

export function isApiError(error: unknown, code?: ApiErrorPayload['code']): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
