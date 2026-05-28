/**
 * TASK-08 — Trigger: nova oferta de emprego.
 *
 * Dispara em `job_offers/{offerId}` create. Só notifica quando a oferta entra
 * como `'pending_review'` (estado por defeito ao criar — confirmado em E5
 * audit, CreateJobPage linha 298: `status: 'pending_review'`).
 *
 * Notifica TODOS os utilizadores com role de moderação CPC
 * (`listCpcModerators` resolve via scan da collection `users`).
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { getFirestore } from './admin';
import { enqueueEmail, listCpcModerators } from './notificationHelpers';

export const onJobOfferCreated = onDocumentCreated('job_offers/{offerId}', async (event) => {
  const offerId = event.params.offerId as string;
  const offer = event.data?.data();
  if (!offer) return;

  const status = typeof offer.status === 'string' ? offer.status : null;
  if (status !== 'pending_review') {
    // Ofertas criadas já noutros estados (ex.: import legado) não despertam moderação.
    return;
  }

  const offerTitle = typeof offer.title === 'string' && offer.title.trim() ? offer.title.trim() : 'Oferta';
  const companyId = typeof offer.company_id === 'string' ? offer.company_id : null;

  let companyName = 'Empresa';
  if (companyId) {
    try {
      const compSnap = await getFirestore().doc(`companies/${companyId}`).get();
      const comp = compSnap.exists ? compSnap.data() : null;
      if (comp && typeof comp.company_name === 'string' && comp.company_name.trim()) {
        companyName = comp.company_name.trim();
      }
    } catch (err) {
      logger.warn('onJobOfferCreated_company_lookup_failed', { offerId, companyId, error: String(err) });
    }
  }

  const moderators = await listCpcModerators();
  if (moderators.length === 0) {
    logger.warn('onJobOfferCreated_no_moderators_found', { offerId });
    return;
  }

  // Envia um email separado por moderador (cada um respeita a sua locale).
  await Promise.all(
    moderators.map((m) =>
      enqueueEmail({
        to: m.to,
        templateName: 'jobOfferPendingReview',
        locale: m.locale,
        vars: { offerTitle, companyName },
        tag: 'job-offer-pending-review',
        contextId: offerId,
      })
    )
  );
});
