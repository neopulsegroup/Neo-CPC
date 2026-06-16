/**
 * T-07 / T-08 / T-10 (LGPD): fonte única da verdade para o cascade-delete
 * de dados de utilizador. A mesma lista é replicada server-side em
 * `functions/src/lib/userCollections.ts` — mantém sincronizadas.
 *
 * Não inclui collections que servem como audit/registo histórico
 * (`audit_logs`, `cv_uploads_audit`, `security_rate_limits`) — esses
 * preservam-se mesmo após delete para LGPD/RGPD compliance audit-trail.
 */

/** Collections indexadas por uid no campo (uid = field value). */
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

/** Apenas para role=company (a apagar à parte se aplicável). */
export const COMPANY_DATA_COLLECTIONS_BY_DOC_ID: ReadonlyArray<string> = [
  'companies',
] as const;
