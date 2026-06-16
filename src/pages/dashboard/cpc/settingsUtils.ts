/**
 * Utilitários para a página CPC Settings.
 *
 * NOTA (consolidate-resend): toda a infraestrutura SMTP foi removida.
 * As funções `sanitizeHost`, `sanitizeUsername`, `parsePort`, `buildSmtpTestMail`
 * e o tipo `SmtpSecurity` deixaram de existir. O tipo `CpcSystemSettings` tem
 * agora apenas `contactNotificationEmail` (email destinatário das notificações
 * do formulário de contacto).
 */

export type CpcSystemSettings = {
  contactNotificationEmail: string;
  updatedBy?: string | null;
  updatedAt?: unknown;
};

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function buildContactNotificationMail(args: {
  to: string;
  from?: string;
  replyTo?: string;
  name: string;
  email: string;
  message: string;
  createdAtISO: string;
}): { to: string; message: { subject: string; text: string; html: string; replyTo?: string; from?: string } } {
  const to = normalizeEmail(args.to);
  const senderEmail = normalizeEmail(args.email);
  const name = args.name.trim();
  const message = args.message.trim();
  const createdAt = args.createdAtISO;

  const subject = `Novo contacto — ${name || senderEmail}`;
  const text = `Novo contacto recebido.\n\nNome: ${name}\nEmail: ${senderEmail}\nData: ${createdAt}\n\nMensagem:\n${message}\n`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a;">
      <h2 style="margin: 0 0 12px;">Novo contacto</h2>
      <p style="margin: 0 0 6px;"><strong>Nome:</strong> ${escapeHtml(name || '—')}</p>
      <p style="margin: 0 0 6px;"><strong>Email:</strong> ${escapeHtml(senderEmail)}</p>
      <p style="margin: 0 0 12px;"><strong>Data:</strong> ${escapeHtml(createdAt)}</p>
      <div style="padding: 12px; background: #f6f7f9; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</div>
    </div>
  `.trim();

  const mail: { to: string; message: { subject: string; text: string; html: string; replyTo?: string; from?: string } } = {
    to,
    message: {
      subject,
      text,
      html,
    },
  };
  if (args.replyTo && isValidEmail(args.replyTo)) mail.message.replyTo = normalizeEmail(args.replyTo);
  if (args.from && isValidEmail(args.from)) mail.message.from = normalizeEmail(args.from);
  return mail;
}

export function redactSettingsForAudit(input: Partial<CpcSystemSettings> | null | undefined) {
  if (!input) return null;
  return {
    ...input,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
