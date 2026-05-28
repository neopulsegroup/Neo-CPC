#!/usr/bin/env node
/**
 * Grava system_settings/contact e system_settings/smtp no Firestore.
 *
 * Uso (não commitar a palavra-passe):
 *   CPC_SMTP_PASSWORD='***' node scripts/seed-communication-settings.mjs
 *
 * Opcional:
 *   CPC_SMTP_HOST=mail.portalcpc.com
 *   CPC_SMTP_PORT=587
 *   CPC_SMTP_SECURITY=tls|ssl
 *   CPC_SMTP_USER=geral@portalcpc.com
 *   CPC_NOTIFICATION_EMAIL=geral@portalcpc.com
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCredential() {
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonInline?.trim()) return cert(JSON.parse(jsonInline));
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath?.trim()) {
    const abs = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath);
    return cert(JSON.parse(fs.readFileSync(abs, 'utf8')));
  }
  return applicationDefault();
}

function envOr(key, fallback) {
  const v = process.env[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

async function main() {
  const password = process.env.CPC_SMTP_PASSWORD;
  if (!password?.trim()) {
    console.error('Defina CPC_SMTP_PASSWORD no ambiente (não coloque no repositório).');
    process.exit(1);
  }

  const host = envOr('CPC_SMTP_HOST', 'mail.portalcpc.com');
  const port = Number(envOr('CPC_SMTP_PORT', '587'));
  const security = envOr('CPC_SMTP_SECURITY', 'tls') === 'ssl' ? 'ssl' : 'tls';
  const username = envOr('CPC_SMTP_USER', 'geral@portalcpc.com');
  const fromEmail = envOr('CPC_SMTP_FROM', username).toLowerCase();
  const notificationEmail = envOr('CPC_NOTIFICATION_EMAIL', fromEmail).toLowerCase();

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    console.error('CPC_SMTP_PORT inválida.');
    process.exit(1);
  }

  initializeApp({ credential: loadCredential() });
  const db = getFirestore();

  const now = FieldValue.serverTimestamp();
  await db.doc('system_settings/contact').set(
    {
      notificationEmail,
      updatedBy: 'seed-communication-settings',
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc('system_settings/smtp').set(
    {
      host,
      port,
      security,
      username,
      password,
      passwordSet: true,
      fromEmail,
      updatedBy: 'seed-communication-settings',
      updatedAt: now,
    },
    { merge: true }
  );

  console.log('OK: system_settings/contact e system_settings/smtp atualizados.');
  console.log(`  contact.notificationEmail = ${notificationEmail}`);
  console.log(`  smtp = ${username}@${host}:${port} (${security}), from=${fromEmail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
