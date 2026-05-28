"use strict";
/**
 * TASK-08 — Trigger: nova empresa registada.
 *
 * Dispara em `companies/{uid}` create. Email lido de `profiles/{uid}` ou
 * `users/{uid}` (companies/ não armazena email diretamente). Idioma do
 * perfil (default PT). Respeita opt-out.
 *
 * Plano: `company_profiles` foi confirmado como `companies` em TASK-05.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCompanyCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const notificationHelpers_1 = require("./notificationHelpers");
exports.onCompanyCreated = (0, firestore_1.onDocumentCreated)('companies/{uid}', async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data)
        return;
    // Empresa pode ter opt-out gravado direto no doc companies/.
    if (data.email_notifications_enabled === false) {
        firebase_functions_1.logger.info('onCompanyCreated_skipped_opted_out_company_doc', { uid });
        return;
    }
    const recipient = await (0, notificationHelpers_1.resolveRecipient)(uid);
    if (!recipient)
        return; // helper já loga motivo (opt-out ou no_email).
    const companyName = typeof data.company_name === 'string' && data.company_name.trim()
        ? data.company_name.trim()
        : typeof data.name === 'string' && data.name.trim()
            ? data.name.trim()
            : 'Empresa';
    await (0, notificationHelpers_1.enqueueEmail)({
        to: recipient.to,
        templateName: 'welcomeCompany',
        locale: recipient.locale,
        vars: { companyName },
        tag: 'welcome-company',
        contextId: uid,
    });
});
