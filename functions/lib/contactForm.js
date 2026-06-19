"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitContactForm = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./admin");
const contactMessageEmail_1 = require("./contactMessageEmail");
function normalize(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeEmail(value) {
    return normalize(value).toLowerCase();
}
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
/** Callable legado — preferir gravação direta em `contact_messages` + trigger `onContactMessageCreated`. */
exports.submitContactForm = (0, https_1.onCall)({
    region: 'us-central1',
    invoker: 'public',
    cors: true,
}, async (request) => {
    const payload = (request.data || {});
    const name = normalize(payload.name);
    const email = normalizeEmail(payload.email);
    const message = normalize(payload.message);
    if (name.length < 2 || name.length > 120) {
        throw new https_1.HttpsError('invalid-argument', 'Nome inválido.');
    }
    if (!isValidEmail(email)) {
        throw new https_1.HttpsError('invalid-argument', 'Email inválido.');
    }
    if (message.length < 2 || message.length > 5000) {
        throw new https_1.HttpsError('invalid-argument', 'Mensagem inválida.');
    }
    const db = (0, admin_1.getFirestore)();
    try {
        await (0, contactMessageEmail_1.sendContactNotificationEmail)({ name, email, message });
    }
    catch {
        throw new https_1.HttpsError('internal', 'Não foi possível enviar a mensagem neste momento.');
    }
    await db.collection('contact_messages').add({
        name,
        email,
        message,
        source: '/contacto',
        emailDeliveryStatus: 'sent',
        emailSentAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
