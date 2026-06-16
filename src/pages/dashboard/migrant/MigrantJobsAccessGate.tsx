import { Navigate } from 'react-router-dom';
import { useMigrantJobsAccess } from '@/hooks/useMigrantJobsAccess';
import { MIGRANT_JOBS_ACCESS_PROFILE_PATH } from '@/lib/migrantJobsAccess';

export default function MigrantJobsAccessGate({ children }: { children: React.ReactNode }) {
  const { loading, canAccess } = useMigrantJobsAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to={MIGRANT_JOBS_ACCESS_PROFILE_PATH} replace />;
  }

  return <>{children}</>;
}
