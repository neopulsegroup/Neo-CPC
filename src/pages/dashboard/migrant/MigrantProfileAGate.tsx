import { Navigate } from 'react-router-dom';
import { useMigrantProfileAAccess } from '@/hooks/useMigrantProfileAAccess';

const MIGRANT_HOME_PATH = '/dashboard/migrante';

/** Bloqueia SCAS/PDI a migrantes que não sejam Perfil A. */
export default function MigrantProfileAGate({ children }: { children: React.ReactNode }) {
  const { loading, canAccess } = useMigrantProfileAAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to={MIGRANT_HOME_PATH} replace />;
  }

  return <>{children}</>;
}
