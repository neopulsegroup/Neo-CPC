import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { isAdminUser } from './permissions';
import { loadSmtpSettings } from './mailProcessor';
import { createTransport } from './smtp';
import { processMailDocument } from './mailProcessor';
import { registerUserSecure } from './registerUserSecure';
import { submitContactForm } from './contactResend';

// TASK-08 — Triggers de notificação automática por email.
// Cada trigger enfileira em `mail/{id}` e é consumido por `onMailCreated`.
// Falha de envio não bloqueia operação principal; apenas log estruturado.
// Ver functions/README.md para detalhes.
import { onMigrantCreated } from './onMigrantCreated';
import { onCompanyCreated } from './onCompanyCreated';
import { onApplicationCreated } from './onApplicationCreated';
import { onApplicationStatusChanged } from './onApplicationStatusChanged';
import { onJobOfferCreated } from './onJobOfferCreated';

// TASK-07 — Lembretes de sessão (email + in-app).
// onSessionCreated: confirmação imediata + ativa flags reminder_*_pending.
// scheduledReminders: cron 15min processa flags e envia 24h/1h antes.
import { onSessionCreated } from './onSessionCreated';
import { scheduledReminders } from './scheduledReminders';

export const onMailCreated = onDocumentCreated('mail/{mailId}', async (event) => {
  const mailId = event.params.mailId;
  await processMailDocument(mailId);
});

export const testSmtpConnection = onCall(async (request) => {
  const uid = request.auth?.uid ?? null;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão inválida.');
  const ok = await isAdminUser(uid);
  if (!ok) throw new HttpsError('permission-denied', 'Sem permissão.');

  try {
    const smtp = await loadSmtpSettings();
    const transport = createTransport(smtp);
    await transport.verify();
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    const raw = error instanceof Error ? error.message : 'Falha na ligação SMTP.';
    const message = raw.startsWith('SMTP ')
      ? 'Configuração SMTP incompleta. Guarde as definições SMTP antes de testar.'
      : raw;
    return { ok: false, message };
  }
});

export { registerUserSecure, submitContactForm };

// TASK-08 — exports dos 5 triggers de notificação.
export {
  onMigrantCreated,
  onCompanyCreated,
  onApplicationCreated,
  onApplicationStatusChanged,
  onJobOfferCreated,
};

// TASK-07 — exports dos triggers de lembretes de sessão.
export { onSessionCreated, scheduledReminders };
