import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export type SmtpSecurity = 'tls' | 'ssl';

export type SmtpSettings = {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromEmail: string;
};

export function buildTransportOptions(settings: SmtpSettings): SMTPTransport.Options {
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.security === 'ssl',
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  };
}

export function createTransport(settings: SmtpSettings) {
  const options = buildTransportOptions(settings);
  return nodemailer.createTransport(options);
}
