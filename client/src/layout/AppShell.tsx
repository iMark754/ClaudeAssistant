import clsx from 'clsx';
import { DatabaseBackup, FolderKanban, LayoutDashboard, ListChecks, Menu, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Drawer } from '../components/ui/Dialog';
import { CurrentMemberSelect } from './CurrentMemberSelect';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/progetti', label: 'Progetti', icon: FolderKanban },
  { to: '/le-mie-attivita', label: 'Le mie attività', icon: ListChecks },
  { to: '/membri', label: 'Membri', icon: Users },
  { to: '/backup', label: 'Backup e ripristino', icon: DatabaseBackup },
];

function Logo() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 shadow-sm" aria-hidden="true">
      <svg viewBox="0 0 32 32" className="size-5">
        <rect x="5" y="6" width="6" height="20" rx="2" fill="#fff" />
        <rect x="13" y="6" width="6" height="14" rx="2" fill="#fff" opacity=".85" />
        <rect x="21" y="6" width="6" height="9" rx="2" fill="#fff" opacity=".7" />
      </svg>
    </span>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigazione principale" className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={clsx('size-5', isActive ? 'text-brand-600' : 'text-slate-400')} aria-hidden="true" />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Move to the top when changing page (not when only the query string changes).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      <a
        href="#contenuto"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-medium text-brand-700 shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Vai al contenuto
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Apri il menu di navigazione"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link to="/" className="flex items-center gap-2.5 rounded-lg pr-2 font-semibold tracking-tight text-slate-900">
            <Logo />
            <span className="hidden sm:inline">Gestione Progetti</span>
          </Link>
          <div className="ml-auto">
            <CurrentMemberSelect />
          </div>
        </div>
      </header>

      <Drawer open={navOpen} onOpenChange={setNavOpen} title="Menu" side="left" width="max-w-xs">
        <Navigation onNavigate={() => setNavOpen(false)} />
      </Drawer>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <Navigation />
          <p className="mt-auto px-6 py-4 text-xs leading-relaxed text-slate-500">
            Dati salvati in locale.
            <br />
            Orari nel fuso Europe/Rome.
          </p>
        </aside>
        <main id="contenuto" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
