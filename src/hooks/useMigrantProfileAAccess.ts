import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeDocument } from '@/integrations/firebase/firestore';
import {
  canAccessScasAndPdi,
  MIGRANT_CLASSIFICATIONS_COLLECTION,
  normalizeEligibilityProfile,
  type EligibilityProfile,
} from '@/lib/migrantEligibility';

type ClassificationDoc = {
  eligibility_profile?: unknown;
};

/**
 * Acesso a SCAS, PDI e marcação de sessões no dashboard migrante: apenas Perfil A.
 */
export function useMigrantProfileAAccess() {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<EligibilityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setEligibility(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeDocument<ClassificationDoc>({
      collectionName: MIGRANT_CLASSIFICATIONS_COLLECTION,
      documentId: user.uid,
      onNext: (doc) => {
        setEligibility(normalizeEligibilityProfile(doc?.eligibility_profile));
        setLoading(false);
      },
      onError: () => {
        setEligibility(null);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const canAccess = useMemo(() => canAccessScasAndPdi(eligibility), [eligibility]);

  return { eligibility, loading, canAccess };
}
