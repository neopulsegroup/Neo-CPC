import { logger } from 'firebase-functions';

import { getFirestore } from './admin';
import { sendEmail } from './sendEmail';

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown): string {
  return normalize(value).toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ContactMessagePayload = {
  name: string;
  email: string;
  message: string;
};

export async function sendContactNotificationEmail(payload: ContactMessagePayload): Promise<void> {
  const name = normalize(payload.name);
  const email = normalizeEmail(payload.email);
  const message = normalize(payload.message);

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
    await sendEmail({
      to: toEmail,
      replyTo: email,
      subject,
      text,
      html,
    });
  } catch (error: unknown) {
    logger.error('sendContactNotificationEmail error', {
      message: error instanceof Error ? error.message : String(error ?? ''),
    });
    throw error;
  }
}
