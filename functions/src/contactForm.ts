import admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { getFirestore } from './admin';
import { sendEmailViaSmtp } from './sendEmail';

const CONTACT_CORS_ORIGINS: Array<string | RegExp> = [
  'https://www.portalcpc.com',
  'https://portalcpc.com',
  'https://cpc-projeto-app.web.app',
  'https://cpc-projeto-app.firebaseapp.com',
  'https://saas-cpc.vercel.app',
  /^https:\/\/[\w-]+\.portalcpc\.com$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8090',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8090',
];

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const submitContactForm = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: CONTACT_CORS_ORIGINS,
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
    const contactSnap = await db.doc('system_settings/contact').get();
    const contactData = contactSnap.exists ? contactSnap.data() : null;
    const toEmail = normalizeEmail(contactData?.notificationEmail) || 'geral@portalcpc.com';

    const createdAtIso = new Date().toISOString();
    const subject = `Novo contacto — ${name}`;

    const text =
      `Novo contacto recebido.\n\n` +
      `Nome: ${name}\n` +
      `Email: ${email}\n` +
      `Data: ${createdAtIso}\n\n` +
      `Mensagem:\n${message}\n`;

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a;">
        <h2 style="margin: 0 0 12px;">Novo contacto</h2>
        <p style="margin: 0 0 6px;"><strong>Nome:</strong> ${escapeHtml(name)}</p>
        <p style="margin: 0 0 6px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin: 0 0 12px;"><strong>Data:</strong> ${escapeHtml(createdAtIso)}</p>
        <div style="padding: 12px; background: #f6f7f9; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</div>
      </div>
    `.trim();

    try {
      await sendEmailViaSmtp({
        to: toEmail,
        replyTo: email,
        subject,
        text,
        html,
      });
    } catch (error: unknown) {
      logger.error('submitContactForm smtp error', {
        message: error instanceof Error ? error.message : String(error ?? ''),
      });
      throw new HttpsError('internal', 'Não foi possível enviar a mensagem neste momento.');
    }

    await db.collection('contact_messages').add({
      name,
      email,
      message,
      source: '/contacto',
      provider: 'smtp',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);
