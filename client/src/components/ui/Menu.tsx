import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { Check, ChevronDown, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

export const menuContentClass =
  'z-50 min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg data-[state=open]:animate-fade-in';
export const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-slate-800 outline-none select-none data-[highlighted]:bg-slate-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

/** "More actions" menu with a kebab trigger. */
export function ActionMenu({ label = 'Altre azioni', items, trigger }: { label?: string; items: ActionMenuItem[]; trigger?: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuContentClass}>
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />}
              <DropdownMenu.Item
                className={clsx(menuItemClass, item.danger && 'text-red-700 data-[highlighted]:bg-red-50')}
                disabled={item.disabled}
                onSelect={item.onSelect}
              >
                {item.icon}
                {item.label}
              </DropdownMenu.Item>
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface FilterOption<V extends string | number> {
  value: V;
  label: string;
}

/** Multi-select filter built on an accessible menu with checkbox items. */
export function MultiSelectFilter<V extends string | number>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
}) {
  const active = selected.length > 0;
  const summary =
    selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? '1') : active ? `${selected.length}` : null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={clsx(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-xs transition-colors',
            active ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
          aria-label={active ? `${label}: ${selected.length} selezionati` : label}
        >
          {label}
          {summary && <span className="max-w-32 truncate rounded bg-white/70 px-1.5 text-xs">{summary}</span>}
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={clsx(menuContentClass, 'max-h-80 overflow-y-auto')}>
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <DropdownMenu.CheckboxItem
                key={String(option.value)}
                checked={checked}
                className={menuItemClass}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(value) =>
                  onChange(value ? [...selected, option.value] : selected.filter((v) => v !== option.value))
                }
              >
                <span
                  className={clsx(
                    'flex size-4 items-center justify-center rounded border',
                    checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white',
                  )}
                  aria-hidden="true"
                >
                  {checked && <Check className="size-3" strokeWidth={3} />}
                </span>
                {option.label}
              </DropdownMenu.CheckboxItem>
            );
          })}
          {active && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
              <DropdownMenu.Item className={clsx(menuItemClass, 'text-slate-600')} onSelect={() => onChange([])}>
                Azzera selezione
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
