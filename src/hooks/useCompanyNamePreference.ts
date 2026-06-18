import { useEffect, useState } from 'react';
import { queryDocuments, subscribeDocument } from '@/integrations/firebase/firestore';
import { parseCompanyNamePreference, type CompanyNamePreference } from '@/lib/userDisplayName';

export function useCompanyNamePreference(userId?: string | null, enabled = true) {
  const [preference, setPreference] = useState<CompanyNamePreference | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setPreference(null);
      return;
    }

    const applyPreference = (doc: Record<string, unknown> | null | undefined) => {
      setPreference(parseCompanyNamePreference(doc));
    };

    const unsubscribe = subscribeDocument<Record<string, unknown>>({
      collectionName: 'companies',
      documentId: userId,
      onNext: (doc) => {
        if (doc) {
          applyPreference(doc);
        } else {
          void (async () => {
            try {
              const legacy = await queryDocuments<Record<string, unknown> & { id: string }>(
                'companies',
                [{ field: 'user_id', operator: '==', value: userId }],
                undefined,
                1
              );
              applyPreference(legacy[0] || null);
            } catch (error) {
              console.error('Error loading legacy company name preference:', error);
              applyPreference(null);
            }
          })();
        }
      },
      onError: (error) => {
        console.error('Error subscribing company name preference:', error);
      },
    });

    return () => unsubscribe();
  }, [enabled, userId]);

  return preference;
}
