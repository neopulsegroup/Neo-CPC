import { useEffect, useState } from 'react';
import { getDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  companyCanPublishJobs,
  getCompanyRegistrationStatus,
  type CompanyRegistrationStatus,
  type CompanyVerificationDoc,
} from '@/lib/companyVerification';

export function useCompanyVerification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyVerificationDoc | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const uid = user?.uid;
      if (!uid) {
        if (!cancelled) {
          setCompany(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const doc = await getDocument<CompanyVerificationDoc>('companies', uid);
        if (!cancelled) setCompany(doc);
      } catch (error) {
        console.error('Error loading company verification:', error);
        if (!cancelled) setCompany(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const status: CompanyRegistrationStatus = getCompanyRegistrationStatus(company);
  const canPublish = companyCanPublishJobs(company);

  return { loading, company, status, canPublish };
}
