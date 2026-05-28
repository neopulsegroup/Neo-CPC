import type { SmtpSecurity } from '@/pages/dashboard/cpc/settingsUtils';

/** Valores públicos recomendados (sem credenciais). */
export const COMMUNICATION_DEFAULTS = {
  notificationEmail: 'geral@portalcpc.com',
  smtp: {
    host: 'mail.portalcpc.com',
    port: 587,
    security: 'tls' as SmtpSecurity,
    username: 'geral@portalcpc.com',
    fromEmail: 'geral@portalcpc.com',
  },
  passwordResetContinueUrl: 'https://www.portalcpc.com/entrar',
} as const;
