import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeDocument } from '@/integrations/firebase/firestore';
import {
  getMissingMigrantPersonalInfoFields,
  isMigrantPersonalInfoComplete,
  type MigrantProfileFieldsForCompleteness,
} from '@/lib/migrantProfileCompleteness';

export function useMigrantPersonalInfoAccess() {
  const { user, profile } = useAuth();
  const [profileDoc, setProfileDoc] = useState<MigrantProfileFieldsForCompleteness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setProfileDoc(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeDocument<MigrantProfileFieldsForCompleteness>({
      collectionName: 'profiles',
      documentId: user.uid,
      onNext: (doc) => {
        setProfileDoc(doc || null);
        setLoading(false);
      },
      onError: () => {
        setProfileDoc(null);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const authFallbacks = useMemo(
    () => ({
      authName: profile?.name ?? null,
      authPhone: (profile as { phone?: string | null } | null)?.phone ?? null,
    }),
    [profile]
  );

  const isComplete = useMemo(
    () => isMigrantPersonalInfoComplete(profileDoc, authFallbacks),
    [profileDoc, authFallbacks]
  );

  const missingFields = useMemo(
    () => getMissingMigrantPersonalInfoFields(profileDoc, authFallbacks),
    [profileDoc, authFallbacks]
  );

  return {
    profileDoc,
    loading,
    isComplete,
    missingFields,
  };
}
