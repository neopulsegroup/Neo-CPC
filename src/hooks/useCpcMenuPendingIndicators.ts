import { useEffect, useMemo, useState } from 'react';
import { subscribeQuery } from '@/integrations/firebase/firestore';
import {
  countPendingCompanies,
  type CpcMenuPendingCounts,
} from '@/lib/cpcMenuPending';
import { SESSION_STATUS_PENDING_APPROVAL } from '@/lib/sessionApproval';
import { SUPPORT_REQUESTS_COLLECTION } from '@/lib/supportRequests';

const EMPTY: CpcMenuPendingCounts = { agenda: 0, companies: 0, offers: 0 };

/**
 * Contagens em tempo real para badges do menu CPC:
 * - Agenda: pedidos de apoio urgente + sessões em aprovação
 * - Empresas: registos pendentes de verificação
 * - Ofertas: vagas em pending_review
 */
export function useCpcMenuPendingIndicators(): CpcMenuPendingCounts {
  const [pendingSupportCount, setPendingSupportCount] = useState(0);
  const [pendingSessionsCount, setPendingSessionsCount] = useState(0);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);

  useEffect(() => {
    const unsubSupport = subscribeQuery<{ id: string }>({
      collectionName: SUPPORT_REQUESTS_COLLECTION,
      filters: [{ field: 'status', operator: '==', value: 'submetido' }],
      onNext: (docs) => setPendingSupportCount(docs?.length ?? 0),
      onError: () => setPendingSupportCount(0),
    });

    const unsubSessions = subscribeQuery<{ id: string }>({
      collectionName: 'sessions',
      filters: [{ field: 'status', operator: '==', value: SESSION_STATUS_PENDING_APPROVAL }],
      onNext: (docs) => setPendingSessionsCount(docs?.length ?? 0),
      onError: () => setPendingSessionsCount(0),
    });

    const unsubCompanies = subscribeQuery<{ id: string; verified?: unknown; rejected?: unknown }>({
      collectionName: 'companies',
      filters: [],
      onNext: (docs) => setCompaniesCount(countPendingCompanies(docs ?? [])),
      onError: () => setCompaniesCount(0),
    });

    const unsubOffers = subscribeQuery<{ id: string }>({
      collectionName: 'job_offers',
      filters: [{ field: 'status', operator: '==', value: 'pending_review' }],
      onNext: (docs) => setOffersCount(docs?.length ?? 0),
      onError: () => setOffersCount(0),
    });

    return () => {
      unsubSupport();
      unsubSessions();
      unsubCompanies();
      unsubOffers();
    };
  }, []);

  return useMemo(
    () => ({
      agenda: pendingSupportCount + pendingSessionsCount,
      companies: companiesCount,
      offers: offersCount,
    }),
    [pendingSupportCount, pendingSessionsCount, companiesCount, offersCount]
  );
}

export function emptyCpcMenuPendingCounts(): CpcMenuPendingCounts {
  return { ...EMPTY };
}
