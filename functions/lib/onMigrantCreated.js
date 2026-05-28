"use strict";
/**
 * TASK-08 — Trigger: novo perfil de migrante registado.
 *
 * Dispara em `profiles/{uid}` create. Filtra por `role === 'migrant'` (o mesmo
 * documento é também criado para empresas, então o filtro evita duplicação).
 *
 * Envia email "welcomeMigrant" no idioma do perfil (default PT).
 * Respeita opt-out via `email_notifications_enabled !== false`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMigrantCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const notificationHelpers_1 = require("./notificationHelpers");
exports.onMigrantCreated = (0, firestore_1.onDocumentCreated)('profiles/{uid}', async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data)
        return;
    const role = typeof data.role === 'string' ? data.role.toLowerCase() : null;
    if (role !== 'migrant') {
        // Outros roles (company, admin, etc.) são tratados em triggers próprios ou ignorados.
        return;
    }
    if (data.email_notifications_enabled === false) {
        firebase_functions_1.logger.info('onMigrantCreated_skipped_opted_out', { uid });
        return;
    }
    const to = typeof data.email === 'string' ? data.email.trim() : '';
    if (!to) {
        firebase_functions_1.logger.warn('onMigrantCreated_skipped_no_email', { uid });
        return;
    }
    const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Migrante';
    const locale = (0, notificationHelpers_1.asEmailLocale)(data.language ?? data.preferred_language);
    await (0, notificationHelpers_1.enqueueEmail)({
        to,
        templateName: 'welcomeMigrant',
        locale,
        vars: { name },
        tag: 'welcome-migrant',
        contextId: uid,
    });
});
