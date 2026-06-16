"use strict";
/**
 * CPC — Cloud Functions entrypoint.
 *
 * Email transport unificado em RESEND (ver `email/sendEmail.ts`).
 * Canal SMTP foi eliminado em `feature/consolidate-resend` —
 * todos os triggers chamam sendEmail() diretamente, sem fila intermédia.
 *
 * Ver `functions/README.md` para mapa completo de triggers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retentionCleanup = exports.scheduledReminders = exports.onSessionCreated = exports.onJobOfferCreated = exports.onApplicationStatusChanged = exports.onApplicationCreated = exports.onCompanyCreated = exports.onMigrantCreated = exports.deleteOwnAccount = exports.submitContactForm = exports.registerUserSecure = void 0;
const https_1 = require("firebase-functions/v2/https");
const registerUserSecure_1 = require("./registerUserSecure");
Object.defineProperty(exports, "registerUserSecure", { enumerable: true, get: function () { return registerUserSecure_1.registerUserSecure; } });
const contactResend_1 = require("./contactResend");
Object.defineProperty(exports, "submitContactForm", { enumerable: true, get: function () { return contactResend_1.submitContactForm; } });
const deleteOwnAccount_1 = require("./deleteOwnAccount");
Object.defineProperty(exports, "deleteOwnAccount", { enumerable: true, get: function () { return deleteOwnAccount_1.deleteOwnAccount; } });
// TASK-08 — Triggers de notificação automática por email (RESEND).
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
//   onSessionCreated: confirmação imediata + ativa flags reminder_*_pending.
//   scheduledReminders: cron 15min processa flags e envia 24h/1h antes.
const onSessionCreated_1 = require("./onSessionCreated");
Object.defineProperty(exports, "onSessionCreated", { enumerable: true, get: function () { return onSessionCreated_1.onSessionCreated; } });
const scheduledReminders_1 = require("./scheduledReminders");
Object.defineProperty(exports, "scheduledReminders", { enumerable: true, get: function () { return scheduledReminders_1.scheduledReminders; } });
// T-10 (LGPD retention) — cron mensal de retenção de contas inativas.
const retentionCleanup_1 = require("./retentionCleanup");
Object.defineProperty(exports, "retentionCleanup", { enumerable: true, get: function () { return retentionCleanup_1.retentionCleanup; } });
// Manter onCall import disponível para futuros callables — não-op se não usado.
void https_1.onCall;
