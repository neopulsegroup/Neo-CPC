import { onCall, HttpsError } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';

import { getFirestore } from './admin';
import { canManageSystemSettings } from './systemSettingsPermissions';

const MIN_SCORE_OPTIONS = new Set([0.1, 0.3, 0.5, 0.7, 0.9]);
const DEFAULT_MIN_SCORE = 0.5;

type CaptchaProvider = 'recaptcha_v3' | 'hcaptcha';

type ApplyRecaptchaPayload = {
  enabled?: unknown;
  provider?: unknown;
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

function parseProvider(value: unknown): CaptchaProvider {
  return value === 'hcaptcha' ? 'hcaptcha' : 'recaptcha_v3';
}

function isValidSiteKey(provider: CaptchaProvider, siteKey: string): boolean {
  if (!siteKey) return false;
  if (provider === 'hcaptcha') {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteKey);
  }
  return siteKey.length >= 20 && siteKey.length <= 200;
}

function isValidSecretKey(secretKey: string): boolean {
  return secretKey.length >= 20 && secretKey.length <= 500;
}

export const applyRecaptchaSettings = onCall(async (request) => {
  const uid = request.auth?.uid ?? null;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão inválida.');
  if (!(await canManageSystemSettings(uid))) {
    throw new HttpsError('permission-denied', 'Sem permissão para alterar o CAPTCHA.');
  }

  const payload = (request.data || {}) as ApplyRecaptchaPayload;
  const enabled = payload.enabled === true;
  const provider = parseProvider(payload.provider);
  const siteKey = normalizeSiteKey(payload.siteKey);
  const secretKey = normalizeSecretKey(payload.secretKey);
  const minScore = parseMinScore(payload.minScore);

  const db = getFirestore();
  const secretSnap = await db.doc('system_settings/recaptcha').get();
  const secretAlreadySet = secretSnap.exists && secretSnap.data()?.secretKeySet === true;
  const existingSecret =
    typeof secretSnap.data()?.secretKey === 'string' && secretSnap.data()?.secretKey.trim()
      ? secretSnap.data()?.secretKey.trim()
      : '';

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  if (!enabled) {
    batch.set(
      db.doc('system_settings/recaptcha_public'),
      {
        enabled: false,
        provider,
        updatedBy: uid,
        updatedAt: now,
      },
      { merge: true }
    );
    await batch.commit();
    return { ok: true, enabled: false, provider, secretKeySet: secretAlreadySet, minScore };
  }

  if (!isValidSiteKey(provider, siteKey)) {
    throw new HttpsError('invalid-argument', 'Indique uma site key válida.');
  }

  const nextSecret = secretKey || (secretAlreadySet ? existingSecret : '');
  if (!isValidSecretKey(nextSecret)) {
    throw new HttpsError('invalid-argument', 'Indique uma secret key válida.');
  }

  batch.set(
    db.doc('system_settings/recaptcha_public'),
    {
      enabled: true,
      provider,
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

  return { ok: true, enabled: true, provider, secretKeySet: true, minScore };
});
