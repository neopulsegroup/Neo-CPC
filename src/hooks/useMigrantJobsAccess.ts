import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeDocument } from '@/integrations/firebase/firestore';
import {
  canAccessMigrantJobs,
  getMissingProfessionalFieldsForJobs,
  hasEmployerProfessionalAuthorization,
  type MigrantJobsAccessProfile,
} from '@/lib/migrantJobsAccess';

export function useMigrantJobsAccess() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MigrantJobsAccessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeDocument<MigrantJobsAccessProfile>({
      collectionName: 'profiles',
      documentId: user.uid,
      onNext: (doc) => {
        setProfile(doc || null);
        setLoading(false);
      },
      onError: () => {
        setProfile(null);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const canAccess = useMemo(() => canAccessMigrantJobs(profile), [profile]);
  const missingProfessionalFields = useMemo(() => getMissingProfessionalFieldsForJobs(profile), [profile]);
  const hasAuthorization = useMemo(() => hasEmployerProfessionalAuthorization(profile), [profile]);

  return {
    profile,
    loading,
    canAccess,
    missingProfessionalFields,
    hasAuthorization,
  };
}
