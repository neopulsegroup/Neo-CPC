import admin from 'firebase-admin';
import { getFirestore } from './admin';
import { createTransport, type SmtpSettings } from './smtp';

type MailDoc = {
  to?: string;
  message?: {
    subject?: string;
    text?: string;
    html?: string;
    replyTo?: string;
    from?: string;
  };
  tag?: string;
  status?: 'queued' | 'sending' | 'sent' | 'error';
  attempt?: number;
  sentAt?: FirebaseFirestore.Timestamp | null;
  errorMessage?: string | null;
};

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + '…';
}

export async function loadSmtpSettings(): Promise<SmtpSettings> {
  const db = getFirestore();
  const snap = await db.doc('system_settings/smtp').get();
  const data = snap.exists ? snap.data() : null;
  const host = safeString(data?.host).trim();
  const username = safeString(data?.username).trim();
  const password = safeString(data?.password);
  const fromEmail = safeString(data?.fromEmail).trim().toLowerCase();
  const port = typeof data?.port === 'number' ? data.port : Number(safeString(data?.port));
  const securityRaw = safeString(data?.security).toLowerCase();
  const security = securityRaw === 'ssl' ? 'ssl' : 'tls';

  if (!host) throw new Error('SMTP host missing');
  if (!port || port < 1 || port > 65535) throw new Error('SMTP port invalid');
  if (!username) throw new Error('SMTP username missing');
  if (!password) throw new Error('SMTP password missing');
  if (!fromEmail) throw new Error('SMTP fromEmail missing');

  return { host, port, security, username, password, fromEmail };
}

export async function processMailDocument(mailId: string): Promise<void> {
  const db = getFirestore();
  const ref = db.doc(`mail/${mailId}`);
  const auditRef = db.collection('audit_logs');

  const { docData } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { docData: null as MailDoc | null };
    const data = snap.data() as MailDoc;
    if (data.status === 'sent') return { docData: null as MailDoc | null };
    if (data.status === 'sending') return { docData: null as MailDoc | null };
    tx.set(
      ref,
      {
        status: 'sending',
        attempt: (typeof data.attempt === 'number' ? data.attempt : 0) + 1,
        errorMessage: null,
      },
      { merge: true }
    );
    return { docData: data };
  });

  if (!docData) return;

  const to = safeString(docData.to).trim();
  const subject = safeString(docData.message?.subject).trim();
  const text = safeString(docData.message?.text);
  const html = safeString(docData.message?.html);
  const replyTo = safeString(docData.message?.replyTo).trim() || undefined;

  if (!to || !subject || (!text && !html)) {
    await ref.set({ status: 'error', errorMessage: 'Payload inválido.' }, { merge: true });
    return;
  }

  const smtp = await loadSmtpSettings();
  const transporter = createTransport(smtp);
  const from = safeString(docData.message?.from).trim() || smtp.fromEmail;

  try {
    await transporter.sendMail({
      to,
      from,
      replyTo,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    await ref.set({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp(), errorMessage: null }, { merge: true });
    await auditRef.add({
      action: 'mail_sent',
      actor_id: 'system',
      context: 'mail_processor',
      target_id: mailId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro no envio SMTP.';
    await ref.set({ status: 'error', errorMessage: truncate(msg, 800) }, { merge: true });
    await auditRef.add({
      action: 'mail_send_error',
      actor_id: 'system',
      context: 'mail_processor',
      target_id: mailId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      error: truncate(msg, 800),
    });
  }
}
