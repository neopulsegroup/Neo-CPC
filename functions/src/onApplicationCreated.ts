/**
 * TASK-08 — Trigger: nova candidatura.
 *
 * Dispara em `job_applications/{appId}` create. Envia email à empresa dona
 * da vaga, com o título da vaga + nome do migrante.
 *
 * Schema confirmado em TASK-02: `job_id` + `applicant_id` (não
 * `job_offer_id`/`migrant_id`).
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { getFirestore } from './admin';
import { enqueueEmail, resolveRecipient } from './notificationHelpers';

export const onApplicationCreated = onDocumentCreated('job_applications/{appId}', async (event) => {
  const appId = event.params.appId as string;
  const app = event.data?.data();
  if (!app) return;

  const jobId = typeof app.job_id === 'string' ? app.job_id : null;
  const applicantId = typeof app.applicant_id === 'string' ? app.applicant_id : null;
  if (!jobId || !applicantId) {
    logger.warn('onApplicationCreated_skipped_invalid_payload', { appId });
    return;
  }

  const db = getFirestore();

  // 1) Lê oferta para obter company_id e título.
  const offerSnap = await db.doc(`job_offers/${jobId}`).get();
  if (!offerSnap.exists) {
    logger.warn('onApplicationCreated_skipped_offer_missing', { appId, jobId });
    return;
  }
  const offer = offerSnap.data() as Record<string, unknown> | undefined;
  const companyUid = typeof offer?.company_id === 'string' ? offer.company_id : null;
  const jobTitle = typeof offer?.title === 'string' && offer.title.trim() ? offer.title.trim() : 'Oferta';

  if (!companyUid) {
    logger.warn('onApplicationCreated_skipped_no_company_id', { appId, jobId });
    return;
  }

  // 2) Resolve email/locale do destinatário (empresa).
  const recipient = await resolveRecipient(companyUid);
  if (!recipient) return; // helper loga opt-out / no-email.

  // 3) Nome do migrante (best effort).
  let migrantName = 'Migrante';
  try {
    const migrantSnap = await db.doc(`profiles/${applicantId}`).get();
    const migrantData = migrantSnap.exists ? migrantSnap.data() : null;
    if (migrantData && typeof migrantData.name === 'string' && migrantData.name.trim()) {
      migrantName = migrantData.name.trim();
    }
  } catch (err) {
    logger.warn('onApplicationCreated_migrant_lookup_failed', { appId, applicantId, error: String(err) });
  }

  await enqueueEmail({
    to: recipient.to,
    templateName: 'newApplication',
    locale: recipient.locale,
    vars: { jobTitle, migrantName },
    tag: 'new-application',
    contextId: appId,
  });
});
