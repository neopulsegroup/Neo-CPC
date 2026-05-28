"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onJobOfferCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const notificationHelpers_1 = require("./notificationHelpers");
exports.onJobOfferCreated = (0, firestore_1.onDocumentCreated)('job_offers/{offerId}', async (event) => {
    const offerId = event.params.offerId;
    const offer = event.data?.data();
    if (!offer)
        return;
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
            const compSnap = await (0, admin_1.getFirestore)().doc(`companies/${companyId}`).get();
            const comp = compSnap.exists ? compSnap.data() : null;
            if (comp && typeof comp.company_name === 'string' && comp.company_name.trim()) {
                companyName = comp.company_name.trim();
            }
        }
        catch (err) {
            firebase_functions_1.logger.warn('onJobOfferCreated_company_lookup_failed', { offerId, companyId, error: String(err) });
        }
    }
    const moderators = await (0, notificationHelpers_1.listCpcModerators)();
    if (moderators.length === 0) {
        firebase_functions_1.logger.warn('onJobOfferCreated_no_moderators_found', { offerId });
        return;
    }
    // Envia um email separado por moderador (cada um respeita a sua locale).
    await Promise.all(moderators.map((m) => (0, notificationHelpers_1.enqueueEmail)({
        to: m.to,
        templateName: 'jobOfferPendingReview',
        locale: m.locale,
        vars: { offerTitle, companyName },
        tag: 'job-offer-pending-review',
        contextId: offerId,
    })));
});
