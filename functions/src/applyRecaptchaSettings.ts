import { onCall, HttpsError } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';

import { getFirestore } from './admin';
import { canManageSystemSettings } from './systemSettingsPermissions';

const MIN_SCORE_OPTIONS = new Set([0.1, 0.3, 0.5, 0.7, 0.9]);
const DEFAULT_MIN_SCORE = 0.5;

type ApplyRecaptchaPayload = {
  siteKey?: unknown;
  secretKey?: unknown;
  minScore?: unknown;
};

function normalizeSiteKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSecretKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseMinScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (MIN_SCORE_OPTIONS.has(numeric)) return numeric;
  return DEFAULT_MIN_SCORE;
}

export const applyRecaptchaSettings = onCall(async (request) => {
  const uid = request.auth?.uid ?? null;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão inválida.');
  if (!(await canManageSystemSettings(uid))) {
    throw new HttpsError('permission-denied', 'Sem permissão para alterar o reCAPTCHA.');
  }

  const payload = (request.data || {}) as ApplyRecaptchaPayload;
  const siteKey = normalizeSiteKey(payload.siteKey);
  const secretKey = normalizeSecretKey(payload.secretKey);
  const minScore = parseMinScore(payload.minScore);

  if (!siteKey || siteKey.length < 20 || siteKey.length > 200) {
    throw new HttpsError('invalid-argument', 'Indique uma site key válida.');
  }

  const db = getFirestore();
  const secretSnap = await db.doc('system_settings/recaptcha').get();
  const secretAlreadySet = secretSnap.exists && secretSnap.data()?.secretKeySet === true;
  const existingSecret =
    typeof secretSnap.data()?.secretKey === 'string' && secretSnap.data()?.secretKey.trim()
      ? secretSnap.data()?.secretKey.trim()
      : '';

  const nextSecret = secretKey || (secretAlreadySet ? existingSecret : '');
  if (!nextSecret || nextSecret.length < 20 || nextSecret.length > 200) {
    throw new HttpsError('invalid-argument', 'Indique uma secret key válida.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(
    db.doc('system_settings/recaptcha_public'),
    {
      siteKey,
      minScore,
      updatedBy: uid,
      updatedAt: now,
    },
    { merge: true }
  );
  batch.set(
    db.doc('system_settings/recaptcha'),
    {
      secretKey: nextSecret,
      secretKeySet: true,
      updatedBy: uid,
      updatedAt: now,
    },
    { merge: true }
  );
  await batch.commit();

  return { ok: true, secretKeySet: true, minScore };
});
