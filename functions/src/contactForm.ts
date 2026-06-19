import admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { getFirestore } from './admin';
import { sendContactNotificationEmail } from './contactMessageEmail';

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
};

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown): string {
  return normalize(value).toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/** Callable legado — preferir gravação direta em `contact_messages` + trigger `onContactMessageCreated`. */
export const submitContactForm = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: true,
  },
  async (request) => {
    const payload = (request.data || {}) as ContactPayload;
    const name = normalize(payload.name);
    const email = normalizeEmail(payload.email);
    const message = normalize(payload.message);

    if (name.length < 2 || name.length > 120) {
      throw new HttpsError('invalid-argument', 'Nome inválido.');
    }
    if (!isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'Email inválido.');
    }
    if (message.length < 2 || message.length > 5000) {
      throw new HttpsError('invalid-argument', 'Mensagem inválida.');
    }

    const db = getFirestore();

    try {
      await sendContactNotificationEmail({ name, email, message });
    } catch {
      throw new HttpsError('internal', 'Não foi possível enviar a mensagem neste momento.');
    }

    await db.collection('contact_messages').add({
      name,
      email,
      message,
      source: '/contacto',
      emailDeliveryStatus: 'sent',
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);
