import { loadSmtpSettings } from './mailProcessor';
import { createTransport } from './smtp';

export type DirectEmail = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  from?: string;
};

/**
 * Envia um email imediatamente através do SMTP configurado em
 * `system_settings/smtp`. Usado por callables que precisam de feedback
 * síncrono (ex.: formulário de contacto, recuperação de palavra-passe),
 * ao contrário da fila `mail/` consumida por `onMailCreated`.
 */
export async function sendEmailViaSmtp(email: DirectEmail): Promise<void> {
  const to = email.to.trim();
  const subject = email.subject.trim();
  const text = (email.text ?? '').trim();
  const html = (email.html ?? '').trim();

  if (!to) throw new Error('Destinatário em falta.');
  if (!subject) throw new Error('Assunto em falta.');
  if (!text && !html) throw new Error('Conteúdo do email em falta.');

  const smtp = await loadSmtpSettings();
  const transporter = createTransport(smtp);
  const from = email.from?.trim() || smtp.fromEmail;
  const replyTo = email.replyTo?.trim() || undefined;

  await transporter.sendMail({
    to,
    from,
    replyTo,
    subject,
    text: text || undefined,
    html: html || undefined,
  });
}
