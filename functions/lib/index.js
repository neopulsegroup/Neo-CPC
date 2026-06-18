"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledReminders = exports.onSessionCreated = exports.onJobOfferCreated = exports.onApplicationStatusChanged = exports.onApplicationCreated = exports.onCompanyCreated = exports.onMigrantCreated = exports.applyRecaptchaSettings = exports.uploadCvSecure = exports.requestPasswordReset = exports.submitContactForm = exports.registerUserSecure = exports.testSmtpConnection = exports.onMailCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const systemSettingsPermissions_1 = require("./systemSettingsPermissions");
const mailProcessor_1 = require("./mailProcessor");
const smtp_1 = require("./smtp");
const mailProcessor_2 = require("./mailProcessor");
const registerUserSecure_1 = require("./registerUserSecure");
Object.defineProperty(exports, "registerUserSecure", { enumerable: true, get: function () { return registerUserSecure_1.registerUserSecure; } });
const contactForm_1 = require("./contactForm");
Object.defineProperty(exports, "submitContactForm", { enumerable: true, get: function () { return contactForm_1.submitContactForm; } });
const sendPasswordReset_1 = require("./sendPasswordReset");
Object.defineProperty(exports, "requestPasswordReset", { enumerable: true, get: function () { return sendPasswordReset_1.requestPasswordReset; } });
const uploadCvSecure_1 = require("./uploadCvSecure");
Object.defineProperty(exports, "uploadCvSecure", { enumerable: true, get: function () { return uploadCvSecure_1.uploadCvSecure; } });
// TASK-08 — Triggers de notificação automática por email.
// Cada trigger enfileira em `mail/{id}` e é consumido por `onMailCreated`.
// Falha de envio não bloqueia operação principal; apenas log estruturado.
// Ver functions/README.md para detalhes.
const onMigrantCreated_1 = require("./onMigrantCreated");
Object.defineProperty(exports, "onMigrantCreated", { enumerable: true, get: function () { return onMigrantCreated_1.onMigrantCreated; } });
const onCompanyCreated_1 = require("./onCompanyCreated");
Object.defineProperty(exports, "onCompanyCreated", { enumerable: true, get: function () { return onCompanyCreated_1.onCompanyCreated; } });
const onApplicationCreated_1 = require("./onApplicationCreated");
Object.defineProperty(exports, "onApplicationCreated", { enumerable: true, get: function () { return onApplicationCreated_1.onApplicationCreated; } });
const onApplicationStatusChanged_1 = require("./onApplicationStatusChanged");
Object.defineProperty(exports, "onApplicationStatusChanged", { enumerable: true, get: function () { return onApplicationStatusChanged_1.onApplicationStatusChanged; } });
const onJobOfferCreated_1 = require("./onJobOfferCreated");
Object.defineProperty(exports, "onJobOfferCreated", { enumerable: true, get: function () { return onJobOfferCreated_1.onJobOfferCreated; } });
// TASK-07 — Lembretes de sessão (email + in-app).
// onSessionCreated: confirmação imediata + ativa flags reminder_*_pending.
// scheduledReminders: cron 15min processa flags e envia 24h/1h antes.
const onSessionCreated_1 = require("./onSessionCreated");
Object.defineProperty(exports, "onSessionCreated", { enumerable: true, get: function () { return onSessionCreated_1.onSessionCreated; } });
const scheduledReminders_1 = require("./scheduledReminders");
Object.defineProperty(exports, "scheduledReminders", { enumerable: true, get: function () { return scheduledReminders_1.scheduledReminders; } });
const applyRecaptchaSettings_1 = require("./applyRecaptchaSettings");
Object.defineProperty(exports, "applyRecaptchaSettings", { enumerable: true, get: function () { return applyRecaptchaSettings_1.applyRecaptchaSettings; } });
exports.onMailCreated = (0, firestore_1.onDocumentCreated)('mail/{mailId}', async (event) => {
    const mailId = event.params.mailId;
    await (0, mailProcessor_2.processMailDocument)(mailId);
});
exports.testSmtpConnection = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid ?? null;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sessão inválida.');
    const ok = await (0, systemSettingsPermissions_1.canManageSystemSettings)(uid);
    if (!ok)
        throw new https_1.HttpsError('permission-denied', 'Sem permissão.');
    try {
        const smtp = await (0, mailProcessor_1.loadSmtpSettings)();
        const transport = (0, smtp_1.createTransport)(smtp);
        await transport.verify();
        return { ok: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        const raw = error instanceof Error ? error.message : 'Falha na ligação SMTP.';
        const message = raw.startsWith('SMTP ')
            ? 'Configuração SMTP incompleta. Guarde as definições SMTP antes de testar.'
            : raw;
        return { ok: false, message };
    }
});
