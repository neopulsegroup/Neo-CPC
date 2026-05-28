"use strict";
/**
 * TASK-08 — Trigger: nova candidatura.
 *
 * Dispara em `job_applications/{appId}` create. Envia email à empresa dona
 * da vaga, com o título da vaga + nome do migrante.
 *
 * Schema confirmado em TASK-02: `job_id` + `applicant_id` (não
 * `job_offer_id`/`migrant_id`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onApplicationCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const notificationHelpers_1 = require("./notificationHelpers");
exports.onApplicationCreated = (0, firestore_1.onDocumentCreated)('job_applications/{appId}', async (event) => {
    const appId = event.params.appId;
    const app = event.data?.data();
    if (!app)
        return;
    const jobId = typeof app.job_id === 'string' ? app.job_id : null;
    const applicantId = typeof app.applicant_id === 'string' ? app.applicant_id : null;
    if (!jobId || !applicantId) {
        firebase_functions_1.logger.warn('onApplicationCreated_skipped_invalid_payload', { appId });
        return;
    }
    const db = (0, admin_1.getFirestore)();
    // 1) Lê oferta para obter company_id e título.
    const offerSnap = await db.doc(`job_offers/${jobId}`).get();
    if (!offerSnap.exists) {
        firebase_functions_1.logger.warn('onApplicationCreated_skipped_offer_missing', { appId, jobId });
        return;
    }
    const offer = offerSnap.data();
    const companyUid = typeof offer?.company_id === 'string' ? offer.company_id : null;
    const jobTitle = typeof offer?.title === 'string' && offer.title.trim() ? offer.title.trim() : 'Oferta';
    if (!companyUid) {
        firebase_functions_1.logger.warn('onApplicationCreated_skipped_no_company_id', { appId, jobId });
        return;
    }
    // 2) Resolve email/locale do destinatário (empresa).
    const recipient = await (0, notificationHelpers_1.resolveRecipient)(companyUid);
    if (!recipient)
        return; // helper loga opt-out / no-email.
    // 3) Nome do migrante (best effort).
    let migrantName = 'Migrante';
    try {
        const migrantSnap = await db.doc(`profiles/${applicantId}`).get();
        const migrantData = migrantSnap.exists ? migrantSnap.data() : null;
        if (migrantData && typeof migrantData.name === 'string' && migrantData.name.trim()) {
            migrantName = migrantData.name.trim();
        }
    }
    catch (err) {
        firebase_functions_1.logger.warn('onApplicationCreated_migrant_lookup_failed', { appId, applicantId, error: String(err) });
    }
    await (0, notificationHelpers_1.enqueueEmail)({
        to: recipient.to,
        templateName: 'newApplication',
        locale: recipient.locale,
        vars: { jobTitle, migrantName },
        tag: 'new-application',
        contextId: appId,
    });
});
