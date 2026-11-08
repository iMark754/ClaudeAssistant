export const PROJECT_STATUSES = ['attivo', 'in_pausa', 'completato', 'archiviato'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  attivo: 'Attivo',
  in_pausa: 'In pausa',
  completato: 'Completato',
  archiviato: 'Archiviato',
};

export const TASK_STATUSES = ['da_fare', 'in_corso', 'in_revisione', 'fatto'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  in_revisione: 'In revisione',
  fatto: 'Fatto',
};

/** Statuses considered "open" (i.e. not done). */
export const OPEN_TASK_STATUSES = ['da_fare', 'in_corso', 'in_revisione'] as const satisfies readonly TaskStatus[];
export type OpenTaskStatus = (typeof OPEN_TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['bassa', 'media', 'alta', 'urgente'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  bassa: 'Bassa',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

/** Higher number = more important. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  bassa: 0,
  media: 1,
  alta: 2,
  urgente: 3,
};

export const TASK_STATUS_RANK: Record<TaskStatus, number> = {
  da_fare: 0,
  in_corso: 1,
  in_revisione: 2,
  fatto: 3,
};

export const ROLE_SUGGESTIONS = [
  'Project manager',
  'Sviluppatore frontend',
  'Sviluppatore backend',
  'Designer UX/UI',
  'QA / Tester',
  'DevOps',
  'Analista',
  'Marketing',
  'Content editor',
] as const;

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && (TASK_PRIORITIES as readonly string[]).includes(value);
}
