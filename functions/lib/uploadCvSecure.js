"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCvSecure = void 0;
const node_crypto_1 = require("node:crypto");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const permissions_1 = require("./permissions");
const CV_CORS_ORIGINS = [
    'https://www.portalcpc.com',
    'https://portalcpc.com',
    'https://cpc-projeto-app.web.app',
    'https://cpc-projeto-app.firebaseapp.com',
    'https://saas-cpc.vercel.app',
    /^https:\/\/[\w-]+\.portalcpc\.com$/,
    /^https:\/\/[\w-]+\.vercel\.app$/,
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8090',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8090',
];
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
function normalize(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
function inferMimeType(fileName, mimeType) {
    if (mimeType && ALLOWED_TYPES.has(mimeType))
        return mimeType;
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf'))
        return 'application/pdf';
    if (lower.endsWith('.doc'))
        return 'application/msword';
    if (lower.endsWith('.docx')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return '';
}
function companyUserIdMatches(data, uid) {
    if (!data)
        return false;
    const userId = data.user_id ?? data.userId;
    if (typeof userId === 'string' && userId === uid)
        return true;
    if (userId && typeof userId === 'object' && 'path' in userId) {
        const path = String(userId.path || '');
        return path.endsWith(`/${uid}`);
    }
    return false;
}
async function employerOwnsCompanyId(uid, companyId) {
    if (!companyId)
        return false;
    if (companyId === uid)
        return true;
    const compSnap = await (0, admin_1.getFirestore)().doc(`companies/${companyId}`).get();
    if (!compSnap.exists)
        return false;
    return companyUserIdMatches(compSnap.data(), uid);
}
async function isEmployerPublisher(uid) {
    const db = (0, admin_1.getFirestore)();
    const [userSnap, profileSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);
    const roleFrom = (data) => {
        const raw = data?.role ?? data?.profile ?? data?.perfil ?? data?.type;
        return typeof raw === 'string' ? raw.toLowerCase() : '';
    };
    const role = roleFrom(userSnap.data()) || roleFrom(profileSnap.data());
    return role === 'company' || role === 'empresa';
}
async function assertCanUploadCv(uid, contextType, contextId) {
    if (contextType !== 'application') {
        throw new https_1.HttpsError('invalid-argument', 'Tipo de contexto não suportado.');
    }
    const appSnap = await (0, admin_1.getFirestore)().doc(`job_applications/${contextId}`).get();
    if (!appSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Candidatura não encontrada.');
    }
    const app = appSnap.data() ?? {};
    if (app.applicant_id === uid)
        return;
    if (await (0, permissions_1.isAdminUser)(uid))
        return;
    const jobId = typeof app.job_id === 'string' ? app.job_id : '';
    if (!jobId) {
        throw new https_1.HttpsError('permission-denied', 'Sem permissão para anexar CV a esta candidatura.');
    }
    const jobSnap = await (0, admin_1.getFirestore)().doc(`job_offers/${jobId}`).get();
    const companyId = typeof jobSnap.data()?.company_id === 'string' ? jobSnap.data().company_id : '';
    if ((await isEmployerPublisher(uid)) && companyId && (await employerOwnsCompanyId(uid, companyId))) {
        return;
    }
    throw new https_1.HttpsError('permission-denied', 'Sem permissão para anexar CV a esta candidatura.');
}
function buildDownloadUrl(bucketName, storagePath, token) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}
exports.uploadCvSecure = (0, https_1.onCall)({
    region: 'us-central1',
    invoker: 'public',
    cors: CV_CORS_ORIGINS,
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sessão inválida.');
    const payload = (request.data || {});
    const fileName = normalize(payload.fileName);
    const contextId = normalize(payload.contextId);
    const contextType = normalize(payload.contextType);
    const mimeType = inferMimeType(fileName, normalize(payload.mimeType));
    const fileBase64 = normalize(payload.fileBase64);
    if (!fileName || !contextId || !contextType || !fileBase64) {
        throw new https_1.HttpsError('invalid-argument', 'Dados de upload incompletos.');
    }
    if (!mimeType || !ALLOWED_TYPES.has(mimeType)) {
        throw new https_1.HttpsError('invalid-argument', 'Tipo de ficheiro não suportado. Use PDF, DOC ou DOCX.');
    }
    let buffer;
    try {
        buffer = Buffer.from(fileBase64, 'base64');
    }
    catch {
        throw new https_1.HttpsError('invalid-argument', 'Conteúdo do ficheiro inválido.');
    }
    if (!buffer.length) {
        throw new https_1.HttpsError('invalid-argument', 'O ficheiro está vazio.');
    }
    if (buffer.length > MAX_BYTES) {
        throw new https_1.HttpsError('invalid-argument', 'O ficheiro deve ter no máximo 5 MB.');
    }
    await assertCanUploadCv(uid, contextType, contextId);
    const sanitizedName = sanitizeFileName(fileName);
    const timestamp = Date.now();
    const storagePath = `cv_uploads/${contextType}/${contextId}/${timestamp}_${sanitizedName}`;
    const downloadToken = (0, node_crypto_1.randomUUID)();
    const bucket = (0, storage_1.getStorage)((0, admin_1.getAdminApp)()).bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
        contentType: mimeType,
        metadata: {
            metadata: {
                uploaderUid: uid,
                contextType,
                contextId,
                originalName: fileName,
                firebaseStorageDownloadTokens: downloadToken,
            },
        },
    });
    const url = buildDownloadUrl(bucket.name, storagePath, downloadToken);
    const auditId = `${contextType}_${contextId}_${timestamp}`;
    try {
        await (0, admin_1.getFirestore)()
            .collection('cv_uploads_audit')
            .doc(auditId)
            .set({
            contextType,
            contextId,
            uploaderUid: uid,
            fileName: sanitizedName,
            storagePath,
            downloadUrl: url,
            uploadedAt: new Date().toISOString(),
            fileSize: buffer.length,
            fileType: mimeType,
        });
    }
    catch (err) {
        firebase_functions_1.logger.error('uploadCvSecure_audit_failed', { auditId, contextId, error: String(err) });
    }
    return {
        url,
        fileName: sanitizedName,
        storagePath,
    };
});
