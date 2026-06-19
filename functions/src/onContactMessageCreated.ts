import admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { sendContactNotificationEmail } from './contactMessageEmail';

export const onContactMessageCreated = onDocumentCreated('contact_messages/{messageId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';

  if (!name || !email || !message) {
    logger.warn('onContactMessageCreated skipped invalid payload', { messageId: snap.id });
    return;
  }

  if (data.emailDeliveryStatus === 'sent' || data.emailDeliveryStatus === 'sending') {
    return;
  }

  await snap.ref.set({ emailDeliveryStatus: 'sending' }, { merge: true });

  try {
    await sendContactNotificationEmail({ name, email, message });
    await snap.ref.set(
      {
        emailDeliveryStatus: 'sent',
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        emailError: null,
      },
      { merge: true }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro no envio de email.';
    logger.error('onContactMessageCreated email error', { messageId: snap.id, error: errorMessage });
    await snap.ref.set(
      {
        emailDeliveryStatus: 'error',
        emailError: errorMessage.slice(0, 800),
      },
      { merge: true }
    );
  }
});
