import clsx from 'clsx';
import { AlarmClock, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  hasActiveTaskFilters,
  type AssigneeFilter,
  type MemberWithStats,
  type TaskFilters,
} from '@gp/shared';
import { TextInput } from '../../components/ui/Form';
import { MultiSelectFilter } from '../../components/ui/Menu';
import { useDebouncedValue } from '../../lib/hooks';

export function TaskFilterBar({
  filters,
  onChange,
  members,
  showStatus,
  shown,
  total,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  members: MemberWithStats[];
  showStatus: boolean;
  shown: number;
  total: number;
}) {
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search, 200);

  useEffect(() => {
    if (debounced.trim() !== filters.q) onChange({ ...filters, q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep the input in sync when filters are reset from outside.
  useEffect(() => {
    if (filters.q === '' && debounced.trim() !== '') setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const active = hasActiveTaskFilters(showStatus ? filters : { ...filters, statuses: [] });

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative lg:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <TextInput
          type="search"
          aria-label="Cerca attività per titolo"
          placeholder="Cerca attività…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter<AssigneeFilter>
          label="Assegnatario"
          options={[{ value: 'none', label: 'Non assegnate' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          selected={filters.assignees}
          onChange={(assignees) => onChange({ ...filters, assignees })}
        />
        <MultiSelectFilter
          label="Priorità"
          options={[...TASK_PRIORITIES].reverse().map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
          selected={filters.priorities}
          onChange={(priorities) => onChange({ ...filters, priorities })}
        />
        {showStatus && (
          <MultiSelectFilter
            label="Stato"
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
            selected={filters.statuses}
            onChange={(statuses) => onChange({ ...filters, statuses })}
          />
        )}
        <button
          type="button"
          aria-pressed={filters.overdue}
          onClick={() => onChange({ ...filters, overdue: !filters.overdue })}
          className={clsx(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-xs transition-colors',
            filters.overdue ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          <AlarmClock className="size-4" aria-hidden="true" />
          Solo in ritardo
        </button>
        {active && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              onChange({ q: '', assignees: [], priorities: [], statuses: [], overdue: false });
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-4" aria-hidden="true" />
            Azzera filtri
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 lg:ml-auto" aria-live="polite">
        {active ? `${shown} di ${total} attività` : `${total} ${total === 1 ? 'attività' : 'attività'}`}
      </p>
    </div>
  );
}
