#!/usr/bin/env node
/**
 * Remove TODAS as trilhas, módulos e progresso de trilhas da Firestore.
 *
 * Uso:
 *   node scripts/delete-all-trails.mjs --dry-run
 *   node scripts/delete-all-trails.mjs --confirm
 *
 * Credenciais (uma das opções):
 *   service-account.json na raiz do projeto
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/conta.json
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   gcloud application-default credentials
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.argv.includes('--confirm');

if (!dryRun && !confirmed) {
  console.error('Operação destrutiva. Use --dry-run para simular ou --confirm para apagar.');
  process.exit(1);
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadCredential() {
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonInline?.trim()) return cert(JSON.parse(jsonInline));

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath?.trim()) {
    const abs = isAbsolute(credPath) ? credPath : join(process.cwd(), credPath);
    return cert(JSON.parse(readFileSync(abs, 'utf8')));
  }

  const serviceAccountPath = join(rootDir, 'service-account.json');
  if (existsSync(serviceAccountPath)) {
    return cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')));
  }

  return applicationDefault();
}

initializeApp({ credential: loadCredential() });
const db = getFirestore();

const COLLECTIONS = ['trail_modules', 'user_trail_progress', 'trails'];

async function deleteCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) {
    console.log(`• ${collectionName}: 0 documento(s)`);
    return 0;
  }

  if (dryRun) {
    console.log(`[dry-run] ${collectionName}: ${snap.size} documento(s)`);
    return snap.size;
  }

  let deleted = 0;
  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    ops += 1;
    deleted += 1;

    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`✓ ${collectionName}: ${deleted} documento(s) removido(s)`);
  return deleted;
}

async function main() {
  console.log(dryRun ? 'Simulação — apagar todas as trilhas e módulos' : 'A apagar todas as trilhas e módulos…');

  let total = 0;
  for (const collectionName of COLLECTIONS) {
    total += await deleteCollection(collectionName);
  }

  console.log(
    dryRun
      ? `Simulação concluída (${total} documento(s) no total).`
      : `Limpeza concluída (${total} documento(s) removido(s)).`
  );
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
