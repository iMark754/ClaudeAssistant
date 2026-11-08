import clsx from 'clsx';
import { UserRound } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { useMembers } from '../api/queries';
import { Avatar } from '../components/ui/Avatar';
import { useCurrentMember } from '../lib/currentMember';

/** Header selector for the current member (no authentication: it only personalizes the views). */
export function CurrentMemberSelect({ className }: { className?: string }) {
  const id = useId();
  const { data: members, isLoading } = useMembers();
  const { currentMember, setCurrentMemberId } = useCurrentMember();

  if (!isLoading && members && members.length === 0) {
    return (
      <Link to="/membri" className="text-sm font-medium text-brand-700 hover:underline">
        Aggiungi i membri del team
      </Link>
    );
  }

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <label htmlFor={id} className="hidden text-sm text-slate-600 md:block">
        Stai lavorando come
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center">
          {currentMember ? (
            <Avatar name={currentMember.name} size="xs" decorative />
          ) : (
            <UserRound className="ml-1 size-4 text-amber-700" aria-hidden="true" />
          )}
        </span>
        <select
          id={id}
          aria-label="Membro corrente"
          value={currentMember?.id ?? ''}
          onChange={(e) => setCurrentMemberId(e.target.value ? Number(e.target.value) : null)}
          disabled={isLoading}
          className={clsx(
            'h-9 max-w-[11rem] rounded-lg border pr-8 pl-9 text-sm font-medium sm:max-w-[14rem]',
            currentMember ? 'border-slate-300 bg-white text-slate-800' : 'border-amber-300 bg-amber-50 text-amber-900',
          )}
        >
          <option value="">Scegli chi sei…</option>
          {members?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
