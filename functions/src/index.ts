/**
 * CPC — Cloud Functions entrypoint.
 *
 * Email transport unificado em RESEND (ver `email/sendEmail.ts`).
 * Canal SMTP foi eliminado em `feature/consolidate-resend` —
 * todos os triggers chamam sendEmail() diretamente, sem fila intermédia.
 *
 * Ver `functions/README.md` para mapa completo de triggers.
 */

import { onCall } from 'firebase-functions/v2/https';

import { registerUserSecure } from './registerUserSecure';
import { submitContactForm } from './contactResend';
import { deleteOwnAccount } from './deleteOwnAccount';

// TASK-08 — Triggers de notificação automática por email (RESEND).
import { onMigrantCreated } from './onMigrantCreated';
import { onCompanyCreated } from './onCompanyCreated';
import { onApplicationCreated } from './onApplicationCreated';
import { onApplicationStatusChanged } from './onApplicationStatusChanged';
import { onJobOfferCreated } from './onJobOfferCreated';

// TASK-07 — Lembretes de sessão (email + in-app).
//   onSessionCreated: confirmação imediata + ativa flags reminder_*_pending.
//   scheduledReminders: cron 15min processa flags e envia 24h/1h antes.
import { onSessionCreated } from './onSessionCreated';
import { scheduledReminders } from './scheduledReminders';

// T-10 (LGPD retention) — cron mensal de retenção de contas inativas.
import { retentionCleanup } from './retentionCleanup';

// Manter onCall import disponível para futuros callables — não-op se não usado.
void onCall;

export { registerUserSecure, submitContactForm, deleteOwnAccount };

// TASK-08 — exports dos 5 triggers de notificação por email.
export {
  onMigrantCreated,
  onCompanyCreated,
  onApplicationCreated,
  onApplicationStatusChanged,
  onJobOfferCreated,
};

// TASK-07 — exports dos triggers de lembretes de sessão.
export { onSessionCreated, scheduledReminders };

// T-10 (LGPD) — export do cron de retenção.
export { retentionCleanup };
