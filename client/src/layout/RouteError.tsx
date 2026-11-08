import { Compass } from 'lucide-react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { buttonClass } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import { useDocumentTitle } from '../lib/hooks';

export function NotFoundPage() {
  useDocumentTitle('Pagina non trovata');
  return (
    <EmptyState
      icon={Compass}
      title="Pagina non trovata"
      description="L’indirizzo che hai aperto non esiste o non è più disponibile."
      action={
        <Link to="/" className={buttonClass('primary')}>
          Torna alla dashboard
        </Link>
      }
    />
  );
}

/** Fallback for unexpected rendering errors. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="p-6">
        <NotFoundPage />
      </div>
    );
  }
  console.error(error);
  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState
        title="Qualcosa è andato storto"
        message="Si è verificato un errore imprevisto nell’interfaccia. Ricarica la pagina per continuare."
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
