import type { ErrorCode } from '@gp/shared';

/** Error with an HTTP status, a stable code and an Italian message for the user. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    readonly field?: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);

export const badRequest = (message: string) => new AppError(400, 'BAD_REQUEST', message);

export const fieldError = (field: string, message: string, code: ErrorCode = 'VALIDATION_ERROR', status = 422) =>
  new AppError(status, code, message, undefined, field, { [field]: message });

export const archivedError = (message = 'Il progetto è archiviato ed è in sola lettura. Ripristinalo per modificarlo.') =>
  new AppError(409, 'PROJECT_ARCHIVED', message);

export const staleError = (what: 'progetto' | 'attività') =>
  new AppError(
    409,
    'STALE_VERSION',
    what === 'progetto'
      ? 'Il progetto è stato modificato nel frattempo da qualcun altro. Ricarica per vedere la versione aggiornata.'
      : "L'attività è stata modificata nel frattempo da qualcun altro. Ricarica per vedere la versione aggiornata.",
  );
