import { queryDocuments } from '@/integrations/firebase/firestore';
import { createdAtToMs } from '@/lib/firestoreTimestamps';

const ACTIVE_STATUS_FILTER = [{ field: 'status', operator: '==' as const, value: 'active' }];

/** Ofertas com `status === 'active'`, ordenadas por `created_at` descendente. Sem índice composto, faz query só por `status` e ordena no cliente. */
export async function loadActiveJobOfferRows<T extends { id: string; created_at?: unknown }>(): Promise<T[]> {
  try {
    return await queryDocuments<T>('job_offers', ACTIVE_STATUS_FILTER, { field: 'created_at', direction: 'desc' });
  } catch {
    const docs = await queryDocuments<T>('job_offers', ACTIVE_STATUS_FILTER);
    return [...docs].sort((a, b) => createdAtToMs(b.created_at) - createdAtToMs(a.created_at));
  }
}
