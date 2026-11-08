export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'PROJECT_ARCHIVED',
  'PROJECT_HAS_OPEN_TASKS',
  'PROJECT_COMPLETED',
  'PROJECT_DUE_BEFORE_TASKS',
  'TASK_DUE_AFTER_PROJECT',
  'MEMBER_OWNS_PROJECTS',
  'INVALID_REFERENCE',
  'STALE_VERSION',
  'BACKUP_INVALID',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorPayload {
  code: ErrorCode | 'NETWORK_ERROR';
  message: string;
  /** Field the error refers to, when it can be shown inline in a form. */
  field?: string;
  /** Per-field messages for validation errors. */
  fieldErrors?: Record<string, string>;
  details?: unknown;
}

export interface ApiErrorBody {
  error: ApiErrorPayload;
}

/** Details attached to PROJECT_HAS_OPEN_TASKS. */
export interface OpenTasksDetails {
  openCount: number;
  byStatus: { da_fare: number; in_corso: number; in_revisione: number };
  tasks: { id: number; title: string; status: 'da_fare' | 'in_corso' | 'in_revisione' }[];
}

/** Details attached to PROJECT_DUE_BEFORE_TASKS. */
export interface ConflictingTasksDetails {
  count: number;
  tasks: { id: number; title: string; dueDate: string }[];
}

/** Details attached to MEMBER_OWNS_PROJECTS. */
export interface OwnedProjectsDetails {
  projects: { id: number; name: string }[];
}
