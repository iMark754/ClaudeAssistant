import { toast } from 'sonner';
import type { z } from 'zod';
import { zodFieldErrors } from '@gp/shared';
import { ApiError, errorMessage } from '../api/client';

export type FieldErrors = Record<string, string>;

/** Validates with a shared schema; returns the parsed data or the per-field errors. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): { data: z.output<S>; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(value);
  return result.success ? { data: result.data, errors: null } : { data: null, errors: zodFieldErrors(result.error) };
}

/** Shows server-side field errors inline when possible, otherwise as a toast. */
export function handleFormError(error: unknown, setErrors: (errors: FieldErrors) => void): void {
  if (error instanceof ApiError && error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
    setErrors(error.fieldErrors);
    return;
  }
  toast.error(errorMessage(error));
}
