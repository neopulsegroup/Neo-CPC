"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRecaptchaSettings = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const admin_1 = require("./admin");
const systemSettingsPermissions_1 = require("./systemSettingsPermissions");
const MIN_SCORE_OPTIONS = new Set([0.1, 0.3, 0.5, 0.7, 0.9]);
const DEFAULT_MIN_SCORE = 0.5;
function normalizeSiteKey(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeSecretKey(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function parseMinScore(value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (MIN_SCORE_OPTIONS.has(numeric))
        return numeric;
    return DEFAULT_MIN_SCORE;
}
function parseProvider(value) {
    return value === 'hcaptcha' ? 'hcaptcha' : 'recaptcha_v3';
}
function isValidSiteKey(provider, siteKey) {
    if (!siteKey)
        return false;
    if (provider === 'hcaptcha') {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteKey);
    }
    return siteKey.length >= 20 && siteKey.length <= 200;
}
function isValidSecretKey(secretKey) {
    return secretKey.length >= 20 && secretKey.length <= 500;
}
exports.applyRecaptchaSettings = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid ?? null;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sessão inválida.');
    if (!(await (0, systemSettingsPermissions_1.canManageSystemSettings)(uid))) {
        throw new https_1.HttpsError('permission-denied', 'Sem permissão para alterar o CAPTCHA.');
    }
    const payload = (request.data || {});
    const enabled = payload.enabled === true;
    const provider = parseProvider(payload.provider);
    const siteKey = normalizeSiteKey(payload.siteKey);
    const secretKey = normalizeSecretKey(payload.secretKey);
    const minScore = parseMinScore(payload.minScore);
    const db = (0, admin_1.getFirestore)();
    const secretSnap = await db.doc('system_settings/recaptcha').get();
    const secretAlreadySet = secretSnap.exists && secretSnap.data()?.secretKeySet === true;
    const existingSecret = typeof secretSnap.data()?.secretKey === 'string' && secretSnap.data()?.secretKey.trim()
        ? secretSnap.data()?.secretKey.trim()
        : '';
    const now = firebase_admin_1.default.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    if (!enabled) {
        batch.set(db.doc('system_settings/recaptcha_public'), {
            enabled: false,
            provider,
            updatedBy: uid,
            updatedAt: now,
        }, { merge: true });
        await batch.commit();
        return { ok: true, enabled: false, provider, secretKeySet: secretAlreadySet, minScore };
    }
    if (!isValidSiteKey(provider, siteKey)) {
        throw new https_1.HttpsError('invalid-argument', 'Indique uma site key válida.');
    }
    const nextSecret = secretKey || (secretAlreadySet ? existingSecret : '');
    if (!isValidSecretKey(nextSecret)) {
        throw new https_1.HttpsError('invalid-argument', 'Indique uma secret key válida.');
    }
    batch.set(db.doc('system_settings/recaptcha_public'), {
        enabled: true,
        provider,
        siteKey,
        minScore,
        updatedBy: uid,
        updatedAt: now,
    }, { merge: true });
    batch.set(db.doc('system_settings/recaptcha'), {
        secretKey: nextSecret,
        secretKeySet: true,
        updatedBy: uid,
        updatedAt: now,
    }, { merge: true });
    await batch.commit();
    return { ok: true, enabled: true, provider, secretKeySet: true, minScore };
});
