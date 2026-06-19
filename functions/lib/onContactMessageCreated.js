"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onContactMessageCreated = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const contactMessageEmail_1 = require("./contactMessageEmail");
exports.onContactMessageCreated = (0, firestore_1.onDocumentCreated)('contact_messages/{messageId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const message = typeof data.message === 'string' ? data.message.trim() : '';
    if (!name || !email || !message) {
        firebase_functions_1.logger.warn('onContactMessageCreated skipped invalid payload', { messageId: snap.id });
        return;
    }
    if (data.emailDeliveryStatus === 'sent' || data.emailDeliveryStatus === 'sending') {
        return;
    }
    await snap.ref.set({ emailDeliveryStatus: 'sending' }, { merge: true });
    try {
        await (0, contactMessageEmail_1.sendContactNotificationEmail)({ name, email, message });
        await snap.ref.set({
            emailDeliveryStatus: 'sent',
            emailSentAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            emailError: null,
        }, { merge: true });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro no envio de email.';
        firebase_functions_1.logger.error('onContactMessageCreated email error', { messageId: snap.id, error: errorMessage });
        await snap.ref.set({
            emailDeliveryStatus: 'error',
            emailError: errorMessage.slice(0, 800),
        }, { merge: true });
    }
});
