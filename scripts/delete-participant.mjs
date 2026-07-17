#!/usr/bin/env node
/**
 * Remove um participante/migrante e todos os dados associados (incl. SCAS e PDI).
 *
 * Uso:
 *   node scripts/delete-participant.mjs <uid> --dry-run
 *   node scripts/delete-participant.mjs <uid> --confirm
 *   node scripts/delete-participant.mjs <uid> --confirm --delete-auth
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
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const uid = process.argv[2]?.trim();
const dryRun = process.argv.includes('--dry-run');
const confirmed = process.argv.includes('--confirm');
const deleteAuth = process.argv.includes('--delete-auth');

if (!uid) {
  console.error('Uso: node scripts/delete-participant.mjs <uid> [--dry-run | --confirm] [--delete-auth]');
  process.exit(1);
}

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

initializeApp({
  credential: loadCredential(),
  projectId: 'cpc-projeto-app',
});
const db = getFirestore();

async function queryByField(collection, field, value) {
  const snap = await db.collection(collection).where(field, '==', value).get();
  return snap.docs;
}

async function queryArrayContains(collection, field, value) {
  const snap = await db.collection(collection).where(field, 'array-contains', value).get();
  return snap.docs;
}

async function deleteDocs(label, docs) {
  if (docs.length === 0) {
    console.log(`• ${label}: 0 documento(s)`);
    return 0;
  }

  if (dryRun) {
    console.log(`[dry-run] ${label}: ${docs.length} documento(s)`);
    for (const doc of docs.slice(0, 5)) {
      console.log(`    - ${doc.ref.path}`);
    }
    if (docs.length > 5) console.log(`    … e mais ${docs.length - 5}`);
    return docs.length;
  }

  let deleted = 0;
  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;

  for (const doc of docs) {
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

  console.log(`✓ ${label}: ${deleted} documento(s) eliminado(s)`);
  return deleted;
}

async function deleteDocRef(path) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`• ${path}: não existe`);
    return 0;
  }
  if (dryRun) {
    console.log(`[dry-run] ${path}: 1 documento`);
    return 1;
  }
  await ref.delete();
  console.log(`✓ ${path}: eliminado`);
  return 1;
}

async function main() {
  console.log(`Participante: ${uid}`);
  console.log(`Modo: ${dryRun ? 'dry-run' : 'confirm'}`);
  console.log('---');

  const userSnap = await db.doc(`users/${uid}`).get();
  const profileSnap = await db.doc(`profiles/${uid}`).get();
  if (userSnap.exists) {
    const u = userSnap.data();
    console.log(`Utilizador: ${u?.email ?? '(sem email)'} | role: ${u?.role ?? '?'}`);
  } else {
    console.log('Utilizador: documento users/{uid} não encontrado');
  }
  if (profileSnap.exists) {
    const p = profileSnap.data();
    console.log(`Perfil: ${p?.name ?? '(sem nome)'}`);
  }
  console.log('---');

  const scasAssessments = await queryByField('scas_assessments', 'participant_id', uid);
  const assessmentIds = scasAssessments.map((d) => d.id);

  const scasResponses = [];
  for (const assessmentId of assessmentIds) {
    const rows = await queryByField('scas_responses', 'assessment_id', assessmentId);
    scasResponses.push(...rows);
  }

  const [
    scasAudit,
    pdiDocs,
    pdiAcceptance,
    pdiVersionLog,
    sessions,
    supportRequests,
    progress,
    applications,
    moduleComments,
    notifications,
    conversations,
  ] = await Promise.all([
    queryByField('scas_audit_log', 'participant_id', uid),
    queryByField('pdi', 'participant_id', uid),
    queryByField('pdi_acceptance', 'participant_id', uid),
    queryByField('pdi_version_log', 'participant_id', uid),
    queryByField('sessions', 'migrant_id', uid),
    queryByField('support_requests', 'migrant_id', uid),
    queryByField('user_trail_progress', 'user_id', uid),
    queryByField('job_applications', 'applicant_id', uid),
    queryByField('trail_module_comments', 'user_id', uid),
    queryByField('notifications', 'recipient_id', uid),
    queryArrayContains('conversations', 'participants', uid),
  ]);

  const conversationIds = conversations.map((d) => d.id);
  const conversationMessages = [];
  for (const conversationId of conversationIds) {
    const rows = await queryByField('conversation_messages', 'conversation_id', conversationId);
    conversationMessages.push(...rows);
  }

  let total = 0;
  total += await deleteDocs('scas_responses', scasResponses);
  total += await deleteDocs('scas_assessments (Impacto SCAS)', scasAssessments);
  total += await deleteDocs('scas_audit_log', scasAudit);
  total += await deleteDocs('pdi', pdiDocs);
  total += await deleteDocs('pdi_acceptance', pdiAcceptance);
  total += await deleteDocs('pdi_version_log', pdiVersionLog);
  total += await deleteDocs('conversation_messages', conversationMessages);
  total += await deleteDocs('conversations', conversations);
  total += await deleteDocs('support_requests', supportRequests);
  total += await deleteDocs('sessions', sessions);
  total += await deleteDocs('user_trail_progress', progress);
  total += await deleteDocs('job_applications', applications);
  total += await deleteDocs('trail_module_comments', moduleComments);
  total += await deleteDocs('notifications', notifications);
  total += await deleteDocRef(`migrant_classifications/${uid}`);
  total += await deleteDocRef(`triage/${uid}`);
  total += await deleteDocRef(`profiles/${uid}`);
  total += await deleteDocRef(`users/${uid}`);

  if (deleteAuth) {
    if (dryRun) {
      console.log('[dry-run] Firebase Auth: utilizador seria eliminado');
    } else {
      try {
        await getAuth().deleteUser(uid);
        console.log('✓ Firebase Auth: utilizador eliminado');
      } catch (error) {
        const code = error?.code ?? error?.errorInfo?.code;
        if (code === 'auth/user-not-found') {
          console.log('• Firebase Auth: utilizador não encontrado');
        } else {
          throw error;
        }
      }
    }
  }

  console.log('---');
  console.log(`${dryRun ? 'Simulação' : 'Eliminação'} concluída. Documentos afetados: ${total}`);

  if (!dryRun) {
    const stillUser = await db.doc(`users/${uid}`).get();
    const stillScas = await queryByField('scas_assessments', 'participant_id', uid);
    if (stillUser.exists || stillScas.length > 0) {
      console.warn('AVISO: ainda existem restos do participante na base de dados.');
      process.exit(2);
    }
    console.log('Verificação OK: participante removido do Impacto SCAS e da base de dados.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
