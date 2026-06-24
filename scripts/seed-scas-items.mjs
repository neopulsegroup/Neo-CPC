#!/usr/bin/env node
/**
 * Seed do catálogo SCAS (coleção `scas_items`, ids 1..21).
 *
 * Cada item guarda o domínio, a ordem e a chave i18n (o texto traduzido vive
 * nos locales em `scas.items.<id>`). Mapeamento de domínios conforme o prompt 4.2.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed-scas-items.mjs
 * ou
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{...}' node scripts/seed-scas-items.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DOMAIN_ITEMS = {
  D1: [1, 3, 6, 10, 11, 13, 16, 20, 21],
  D2: [4, 8, 14, 18],
  D3: [5, 9, 15, 19],
  D4: [2, 7, 12, 17],
};

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

function buildItems() {
  const itemDomain = {};
  for (const [domain, ids] of Object.entries(DOMAIN_ITEMS)) {
    for (const id of ids) itemDomain[id] = domain;
  }
  const items = [];
  for (let id = 1; id <= 21; id += 1) {
    items.push({
      id,
      domain: itemDomain[id],
      display_order: id,
      i18n_key: `scas.items.${id}`,
    });
  }
  return items;
}

async function main() {
  initializeApp({ credential: loadCredential() });
  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  const items = buildItems();
  const batch = db.batch();
  for (const item of items) {
    batch.set(
      db.doc(`scas_items/${item.id}`),
      { ...item, updatedAt: now, updatedBy: 'seed-scas-items' },
      { merge: true }
    );
  }
  await batch.commit();

  console.log(`OK: ${items.length} itens SCAS gravados em scas_items.`);
  for (const domain of Object.keys(DOMAIN_ITEMS)) {
    console.log(`  ${domain}: ${DOMAIN_ITEMS[domain].join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
