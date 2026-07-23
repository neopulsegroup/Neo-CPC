import { Navigate, useLocation } from 'react-router-dom';
import { useMigrantPersonalInfoAccess } from '@/hooks/useMigrantPersonalInfoAccess';
import { MIGRANT_PERSONAL_INFO_PROFILE_PATH } from '@/lib/migrantProfileCompleteness';

function isPersonalInfoAllowedPath(pathname: string): boolean {
  return (
    pathname === MIGRANT_PERSONAL_INFO_PROFILE_PATH ||
    pathname.startsWith(`${MIGRANT_PERSONAL_INFO_PROFILE_PATH}/`)
  );
}

/** Bloqueia todas as secções do dashboard migrante até a Informação Pessoal estar completa. */
export default function MigrantPersonalInfoGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { loading, isComplete } = useMigrantPersonalInfoAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isComplete && !isPersonalInfoAllowedPath(location.pathname)) {
    return <Navigate to={MIGRANT_PERSONAL_INFO_PROFILE_PATH} replace />;
  }

  return <>{children}</>;
}
