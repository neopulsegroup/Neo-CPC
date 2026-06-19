#!/usr/bin/env node
/**
 * Remove trilhas de demonstração da Firestore (trails, trail_modules, user_trail_progress).
 *
 * Uso:
 *   node scripts/delete-demo-trails.mjs
 *   node scripts/delete-demo-trails.mjs --dry-run
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEMO_TRAIL_TITLES = [
  'Situação Legal',
  'Teste - Testar',
  'Direitos Laborais em Portugal',
  'Cultura e Costumes Portugueses',
  'Sistema de Saúde em Portugal',
  'Preparação para o Trabalho',
  'Finanças do Dia a Dia',
  'Habitação e Arrendamento',
  'Contratos e Recibos: o Essencial',
  'Comunicação no Dia a Dia',
  'Saúde Mental e Bem-estar',
  'Entrevistas e Integração na Equipa',
];

const demoTitleSet = new Set(DEMO_TRAIL_TITLES.map((title) => title.trim().toLowerCase()));

function isDemoTrail(doc) {
  const title = typeof doc.data().title === 'string' ? doc.data().title.trim().toLowerCase() : '';
  return doc.id.startsWith('demo-trail-') || demoTitleSet.has(title);
}

const dryRun = process.argv.includes('--dry-run');
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const serviceAccountPath = join(rootDir, 'service-account.json');

if (!existsSync(serviceAccountPath)) {
  console.error('Ficheiro service-account.json não encontrado na raiz do projeto.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deleteQueryBatch(query, label) {
  const snap = await query.get();
  if (snap.empty) return 0;
  if (dryRun) {
    console.log(`[dry-run] ${label}: ${snap.size} documento(s)`);
    return snap.size;
  }
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`✓ ${label}: ${snap.size} documento(s) removido(s)`);
  return snap.size;
}

async function main() {
  const trailsSnap = await db.collection('trails').get();
  const trailIds = [];

  for (const doc of trailsSnap.docs) {
    if (!isDemoTrail(doc)) continue;
    trailIds.push(doc.id);
    const title = doc.data().title ?? doc.id;
    if (dryRun) {
      console.log(`[dry-run] trail: ${doc.id} (${title})`);
    } else {
      await doc.ref.delete();
      console.log(`✓ trail removida: ${doc.id} (${title})`);
    }
  }

  const uniqueTrailIds = [...new Set(trailIds)];

  for (const trailId of uniqueTrailIds) {
    await deleteQueryBatch(db.collection('trail_modules').where('trail_id', '==', trailId), `módulos de ${trailId}`);
    await deleteQueryBatch(db.collection('user_trail_progress').where('trail_id', '==', trailId), `progresso de ${trailId}`);
  }

  console.log(
    dryRun
      ? `Simulação concluída (${uniqueTrailIds.length} trilha(s) demo).`
      : `Limpeza de trilhas demo concluída (${uniqueTrailIds.length} trilha(s)).`
  );
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
