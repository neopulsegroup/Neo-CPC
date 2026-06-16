"use strict";
/**
 * T-08 / T-10 (LGPD): fonte única da verdade para o cascade-delete
 * de dados de utilizador no servidor. Replica `src/features/admin/userCollections.ts`.
 *
 * Quando alterares uma lista, alterar AMBAS. A divergência entre admin-delete
 * e self-delete é bug de compliance garantido.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_DATA_COLLECTIONS_BY_DOC_ID = exports.USER_DATA_COLLECTIONS_BY_DOC_ID = exports.USER_DATA_COLLECTIONS_BY_FIELD = void 0;
/** Collections indexadas pelo uid no campo. */
exports.USER_DATA_COLLECTIONS_BY_FIELD = [
    { name: 'sessions', field: 'migrant_id' },
    { name: 'user_trail_progress', field: 'user_id' },
    { name: 'job_applications', field: 'applicant_id' },
    { name: 'notifications', field: 'recipient_id' },
];
/** Collections em que o uid é o próprio document id. */
exports.USER_DATA_COLLECTIONS_BY_DOC_ID = [
    'profiles',
    'triage',
    'users',
];
/** Apenas role=company. */
exports.COMPANY_DATA_COLLECTIONS_BY_DOC_ID = [
    'companies',
];
