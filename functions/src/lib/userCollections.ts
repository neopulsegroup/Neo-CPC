/**
 * T-08 / T-10 (LGPD): fonte única da verdade para o cascade-delete
 * de dados de utilizador no servidor. Replica `src/features/admin/userCollections.ts`.
 *
 * Quando alterares uma lista, alterar AMBAS. A divergência entre admin-delete
 * e self-delete é bug de compliance garantido.
 */

/** Collections indexadas pelo uid no campo. */
export const USER_DATA_COLLECTIONS_BY_FIELD: ReadonlyArray<{
  name: string;
  field: string;
}> = [
  { name: 'sessions', field: 'migrant_id' },
  { name: 'user_trail_progress', field: 'user_id' },
  { name: 'job_applications', field: 'applicant_id' },
  { name: 'notifications', field: 'recipient_id' },
] as const;

/** Collections em que o uid é o próprio document id. */
export const USER_DATA_COLLECTIONS_BY_DOC_ID: ReadonlyArray<string> = [
  'profiles',
  'triage',
  'users',
] as const;

/** Apenas role=company. */
export const COMPANY_DATA_COLLECTIONS_BY_DOC_ID: ReadonlyArray<string> = [
  'companies',
] as const;
