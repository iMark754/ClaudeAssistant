import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MemberWithStats } from '@gp/shared';
import { useMembers } from '../api/queries';

const STORAGE_KEY = 'gestione-progetti.membro-corrente';

interface CurrentMemberContextValue {
  currentMember: MemberWithStats | null;
  currentMemberId: number | null;
  setCurrentMemberId: (id: number | null) => void;
}

const CurrentMemberContext = createContext<CurrentMemberContextValue | null>(null);

function readStoredId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const { data: members } = useMembers();
  const [storedId, setStoredId] = useState<number | null>(readStoredId);

  const setCurrentMemberId = useCallback((id: number | null) => {
    setStoredId(id);
    try {
      if (id === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // Storage unavailable (private mode): keep the choice for this session only.
    }
  }, []);

  const currentMember = useMemo(
    () => (storedId === null ? null : (members?.find((m) => m.id === storedId) ?? null)),
    [members, storedId],
  );

  // The stored member may have been deleted (or a backup restored): forget it.
  useEffect(() => {
    if (members && storedId !== null && !currentMember) setCurrentMemberId(null);
  }, [members, storedId, currentMember, setCurrentMemberId]);

  const value = useMemo(
    () => ({ currentMember, currentMemberId: currentMember?.id ?? null, setCurrentMemberId }),
    [currentMember, setCurrentMemberId],
  );
  return <CurrentMemberContext.Provider value={value}>{children}</CurrentMemberContext.Provider>;
}

export function useCurrentMember(): CurrentMemberContextValue {
  const ctx = useContext(CurrentMemberContext);
  if (!ctx) throw new Error('useCurrentMember deve essere usato dentro CurrentMemberProvider');
  return ctx;
}
