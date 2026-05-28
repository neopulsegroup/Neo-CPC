import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Caminho para o arquivo de service account
// Baixar de: console.firebase.google.com > Project Settings > Service Accounts > Generate new private key
const serviceAccount = require('../service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fixRole(uid: string) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      role: 'admin',
      created_at: new Date(),
    });
    console.log(`✓ Documento users/${uid} CRIADO com role=admin`);
  } else {
    const data = snap.data();
    console.log(`Documento já existe. Role atual:`, data?.role, `(tipo: ${typeof data?.role})`);
    await ref.update({ role: 'admin' });
    console.log(`✓ Documento users/${uid} ATUALIZADO para role=admin`);
  }

  // Verificação
  const verifySnap = await ref.get();
  console.log(`Estado final:`, verifySnap.data());
}

const uid = process.argv[2];
if (!uid) {
  console.error('Uso: npx tsx scripts/fix-admin-role.ts <UID>');
  process.exit(1);
}

fixRole(uid).then(() => process.exit(0)).catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
