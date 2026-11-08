import { useEffect, useState } from 'react';
import { todayInRome } from '@gp/shared';

const APP_NAME = 'Gestione Progetti';

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

/** Today's date in Europe/Rome, refreshed every minute (so it changes at midnight). */
export function useToday(): string {
  const [today, setToday] = useState(() => todayInRome());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayInRome()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
