#!/usr/bin/env node
/**
 * Remove sessão de apoio urgente (e pedido associado) por descrição do pedido.
 *
 * Uso:
 *   node scripts/delete-urgent-support-by-description.mjs "123123123123123"
 *   node scripts/delete-urgent-support-by-description.mjs "123123123123123" --dry-run
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const description = process.argv[2]?.trim();
const dryRun = process.argv.includes('--dry-run');

if (!description) {
  console.error('Uso: node scripts/delete-urgent-support-by-description.mjs "<descrição>" [--dry-run]');
  process.exit(1);
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const serviceAccountPath = join(rootDir, 'service-account.json');

function loadCredential() {
  if (existsSync(serviceAccountPath)) {
    return cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')));
  }
  return applicationDefault();
}

initializeApp({
  credential: loadCredential(),
  projectId: 'cpc-projeto-app',
});
const db = getFirestore();

async function main() {
  const supportSnap = await db.collection('support_requests').where('description', '==', description).get();
  const sessionSnap = await db
    .collection('sessions')
    .where('scheduled_date', '==', '2026-06-22')
    .where('scheduled_time', '==', '10:00')
    .get();

  console.log(`Pedidos de apoio com descrição "${description}": ${supportSnap.size}`);
  for (const doc of supportSnap.docs) {
    const data = doc.data();
    console.log(`  support_request/${doc.id}`, {
      status: data.status,
      session_id: data.session_id ?? null,
      specialist_name: data.specialist_name ?? null,
    });
    if (!dryRun) {
      if (data.session_id) {
        await db.doc(`sessions/${data.session_id}`).delete();
        console.log(`  ✓ sessions/${data.session_id} eliminada`);
      }
      await doc.ref.delete();
      console.log(`  ✓ support_requests/${doc.id} eliminado`);
    }
  }

  console.log(`Sessões em 2026-06-22 10:00: ${sessionSnap.size}`);
  for (const doc of sessionSnap.docs) {
    const data = doc.data();
    if (data.support_request_id || (data.specialist_name ?? '').includes('NeoPulse')) {
      console.log(`  sessions/${doc.id}`, {
        support_request_id: data.support_request_id ?? null,
        specialist_name: data.specialist_name ?? null,
        service_label: data.service_label ?? null,
      });
      if (!dryRun) {
        await doc.ref.delete();
        console.log(`  ✓ sessions/${doc.id} eliminada`);
      }
    }
  }

  if (dryRun) console.log('[dry-run] Nenhum documento foi eliminado.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
