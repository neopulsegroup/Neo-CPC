"use strict";
/**
 * TASK-08 — Trigger: status de candidatura mudou.
 *
 * Dispara em `job_applications/{appId}` update. Só notifica quando o status
 * muda PARA `'accepted'` ou `'rejected'` (não para 'reviewing'/'interview' —
 * esses são intermediários que não justificam email).
 *
 * Schema: status canónico tem 5 valores `submitted|reviewing|interview|accepted|rejected`
 * (confirmado em TASK-02).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onApplicationStatusChanged = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const notificationHelpers_1 = require("./notificationHelpers");
const NOTIFIABLE_STATUS_TRANSITIONS = new Set(['accepted', 'rejected']);
exports.onApplicationStatusChanged = (0, firestore_1.onDocumentUpdated)('job_applications/{appId}', async (event) => {
    const appId = event.params.appId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const beforeStatus = typeof before.status === 'string' ? before.status : null;
    const afterStatus = typeof after.status === 'string' ? after.status : null;
    if (!afterStatus || beforeStatus === afterStatus)
        return;
    if (!NOTIFIABLE_STATUS_TRANSITIONS.has(afterStatus))
        return;
    const applicantId = typeof after.applicant_id === 'string' ? after.applicant_id : null;
    const jobId = typeof after.job_id === 'string' ? after.job_id : null;
    if (!applicantId || !jobId) {
        firebase_functions_1.logger.warn('onApplicationStatusChanged_skipped_invalid_payload', { appId });
        return;
    }
    const recipient = await (0, notificationHelpers_1.resolveRecipient)(applicantId);
    if (!recipient)
        return;
    // Busca título da oferta para incluir no email.
    let jobTitle = 'Oferta';
    try {
        const offerSnap = await (0, admin_1.getFirestore)().doc(`job_offers/${jobId}`).get();
        const offer = offerSnap.exists ? offerSnap.data() : null;
        if (offer && typeof offer.title === 'string' && offer.title.trim()) {
            jobTitle = offer.title.trim();
        }
    }
    catch (err) {
        firebase_functions_1.logger.warn('onApplicationStatusChanged_offer_lookup_failed', { appId, jobId, error: String(err) });
    }
    const templateName = afterStatus === 'accepted' ? 'applicationAccepted' : 'applicationRejected';
    const tag = afterStatus === 'accepted' ? 'application-accepted' : 'application-rejected';
    await (0, notificationHelpers_1.enqueueEmail)({
        to: recipient.to,
        templateName,
        locale: recipient.locale,
        vars: { jobTitle },
        tag,
        contextId: appId,
    });
});
