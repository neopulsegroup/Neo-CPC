import { Resend } from 'resend';

import { getFirestore } from './admin';

export type ResendSettings = {
  apiKey: string;
  fromEmail: string;
};

export type ResendOutboundEmail = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  from?: string;
};

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function isResendConfigured(): Promise<boolean> {
  const db = getFirestore();
  const snap = await db.doc('system_settings/resend').get();
  if (!snap.exists) return false;
  const data = snap.data();
  if (data?.enabled !== true) return false;
  const apiKey = safeString(data?.apiKey).trim();
  return apiKey.length > 0;
}

export async function loadResendSettings(): Promise<ResendSettings> {
  const db = getFirestore();
  const snap = await db.doc('system_settings/resend').get();
  const data = snap.exists ? snap.data() : null;
  const apiKey = safeString(data?.apiKey).trim();
  const fromEmail = safeString(data?.fromEmail).trim().toLowerCase();

  if (!apiKey) throw new Error('Resend API key em falta.');
  if (!fromEmail) throw new Error('Email de remetente Resend em falta.');

  return { apiKey, fromEmail };
}

export async function verifyResendConnection(settings: ResendSettings): Promise<void> {
  const resend = new Resend(settings.apiKey);
  const result = await resend.domains.list();
  if (result.error) {
    throw new Error(result.error.message || 'Falha na ligação ao Resend.');
  }
}

export async function sendWithResend(settings: ResendSettings, email: ResendOutboundEmail): Promise<void> {
  const to = email.to.trim();
  const subject = email.subject.trim();
  const text = (email.text ?? '').trim();
  const html = (email.html ?? '').trim();
  const from = email.from?.trim() || settings.fromEmail;
  const replyTo = email.replyTo?.trim() || undefined;

  if (!to) throw new Error('Destinatário em falta.');
  if (!subject) throw new Error('Assunto em falta.');
  if (!text && !html) throw new Error('Conteúdo do email em falta.');

  const resend = new Resend(settings.apiKey);
  const base = {
    from,
    to,
    subject,
    ...(replyTo ? { replyTo } : {}),
  };

  const result = html
    ? await resend.emails.send({ ...base, html, ...(text ? { text } : {}) })
    : await resend.emails.send({ ...base, text });

  if (result.error) {
    throw new Error(result.error.message || 'Erro no envio via Resend.');
  }
}
