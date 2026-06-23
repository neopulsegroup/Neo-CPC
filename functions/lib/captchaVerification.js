"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCaptchaIfRequired = verifyCaptchaIfRequired;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const recaptchaSettings_1 = require("./recaptchaSettings");
function clientIpFromRequest(rawRequest) {
    const forwarded = rawRequest.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0]?.trim() || undefined;
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
        return String(forwarded[0]).trim() || undefined;
    }
    return typeof rawRequest.ip === 'string' && rawRequest.ip.trim() ? rawRequest.ip.trim() : undefined;
}
async function verifyRecaptchaToken(args) {
    const params = new URLSearchParams();
    params.set('secret', args.secret);
    params.set('response', args.token);
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    if (!response.ok) {
        firebase_functions_1.logger.error('captcha_http_error', { requestId: args.requestId, status: response.status, provider: 'recaptcha_v3' });
        throw new https_1.HttpsError('unavailable', 'Não foi possível concluir o cadastro.', {
            error: 'AUTH_PROVIDER_UNAVAILABLE',
            requestId: args.requestId,
        });
    }
    const body = (await response.json());
    const score = typeof body.score === 'number' ? body.score : 0;
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    if (action && action !== 'register') {
        firebase_functions_1.logger.warn('captcha_action_mismatch', { requestId: args.requestId, action, provider: 'recaptcha_v3' });
        throw new https_1.HttpsError('permission-denied', 'Não foi possível concluir o cadastro.', {
            error: 'REGISTRATION_FAILED',
            requestId: args.requestId,
        });
    }
    if (!body.success || score < args.minScore) {
        firebase_functions_1.logger.warn('captcha_failed', {
            requestId: args.requestId,
            score,
            minScore: args.minScore,
            action: action || null,
            provider: 'recaptcha_v3',
        });
        throw new https_1.HttpsError('permission-denied', 'Não foi possível concluir o cadastro.', {
            error: 'REGISTRATION_FAILED',
            requestId: args.requestId,
        });
    }
}
async function verifyHcaptchaToken(args) {
    const params = new URLSearchParams();
    params.set('secret', args.secret);
    params.set('response', args.token);
    params.set('sitekey', args.siteKey);
    if (args.remoteIp)
        params.set('remoteip', args.remoteIp);
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    if (!response.ok) {
        firebase_functions_1.logger.error('captcha_http_error', { requestId: args.requestId, status: response.status, provider: 'hcaptcha' });
        throw new https_1.HttpsError('unavailable', 'Não foi possível concluir o cadastro.', {
            error: 'AUTH_PROVIDER_UNAVAILABLE',
            requestId: args.requestId,
        });
    }
    const body = (await response.json());
    if (body.success !== true) {
        firebase_functions_1.logger.warn('captcha_failed', {
            requestId: args.requestId,
            provider: 'hcaptcha',
            errorCodes: body['error-codes'] ?? [],
        });
        throw new https_1.HttpsError('permission-denied', 'Não foi possível concluir o cadastro.', {
            error: 'REGISTRATION_FAILED',
            requestId: args.requestId,
        });
    }
}
async function verifyCaptchaIfRequired(captchaToken, requestId, rawRequest) {
    const runtime = await (0, recaptchaSettings_1.loadCaptchaRuntimeConfig)();
    if (!runtime.enabled) {
        return;
    }
    const secret = runtime.secretKey;
    const captchaRequired = process.env.RECAPTCHA_REQUIRED !== 'false';
    if (!secret || !runtime.siteKey) {
        if (captchaRequired && process.env.NODE_ENV === 'production') {
            firebase_functions_1.logger.error('captcha_secret_missing_in_production', { requestId, provider: runtime.provider });
            throw new https_1.HttpsError('failed-precondition', 'Não foi possível concluir o cadastro.', {
                error: 'CAPTCHA_REQUIRED',
                requestId,
            });
        }
        return;
    }
    const token = typeof captchaToken === 'string' ? captchaToken.trim() : '';
    if (!token) {
        throw new https_1.HttpsError('failed-precondition', 'Não foi possível concluir o cadastro.', {
            error: 'CAPTCHA_REQUIRED',
            requestId,
        });
    }
    if (runtime.provider === 'hcaptcha') {
        await verifyHcaptchaToken({
            secret,
            token,
            siteKey: runtime.siteKey,
            remoteIp: rawRequest ? clientIpFromRequest(rawRequest) : undefined,
            requestId,
        });
        return;
    }
    await verifyRecaptchaToken({
        secret,
        token,
        minScore: runtime.minScore,
        requestId,
    });
}
