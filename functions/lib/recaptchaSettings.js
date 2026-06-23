"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRecaptchaRuntimeConfig = exports.DEFAULT_RECAPTCHA_MIN_SCORE = void 0;
exports.loadCaptchaRuntimeConfig = loadCaptchaRuntimeConfig;
const admin_1 = require("./admin");
exports.DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;
function parseProvider(value) {
    return value === 'hcaptcha' ? 'hcaptcha' : 'recaptcha_v3';
}
async function loadCaptchaRuntimeConfig() {
    const db = (0, admin_1.getFirestore)();
    const [publicSnap, secretSnap] = await Promise.all([
        db.doc('system_settings/recaptcha_public').get(),
        db.doc('system_settings/recaptcha').get(),
    ]);
    const publicData = publicSnap.exists ? publicSnap.data() : null;
    const secretData = secretSnap.exists ? secretSnap.data() : null;
    const siteKey = typeof publicData?.siteKey === 'string' && publicData.siteKey.trim() ? publicData.siteKey.trim() : null;
    const firestoreSecret = typeof secretData?.secretKey === 'string' && secretData.secretKey.trim()
        ? secretData.secretKey.trim()
        : null;
    const envSecret = process.env.RECAPTCHA_SECRET_KEY?.trim() || process.env.HCAPTCHA_SECRET_KEY?.trim() || null;
    const secretKey = firestoreSecret || envSecret;
    const enabled = publicData?.enabled === true;
    const provider = parseProvider(publicData?.provider);
    const minScoreRaw = publicData?.minScore;
    const minScore = typeof minScoreRaw === 'number' && Number.isFinite(minScoreRaw)
        ? minScoreRaw
        : Number(process.env.RECAPTCHA_MIN_SCORE || exports.DEFAULT_RECAPTCHA_MIN_SCORE);
    return {
        enabled,
        provider,
        siteKey,
        secretKey,
        minScore: Number.isFinite(minScore) ? minScore : exports.DEFAULT_RECAPTCHA_MIN_SCORE,
        configured: enabled && Boolean(secretKey && siteKey),
    };
}
/** @deprecated Utilize `loadCaptchaRuntimeConfig`. */
exports.loadRecaptchaRuntimeConfig = loadCaptchaRuntimeConfig;
