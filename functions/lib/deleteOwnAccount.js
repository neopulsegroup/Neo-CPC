"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOwnAccount = void 0;
exports.cascadeDeleteUserDataServer = cascadeDeleteUserDataServer;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const userCollections_1 = require("./lib/userCollections");
/** Cascade-delete server-side de todos os dados de um utilizador. */
async function cascadeDeleteUserDataServer(db, uid, options = {}) {
    const report = [];
    for (const { name, field } of userCollections_1.USER_DATA_COLLECTIONS_BY_FIELD) {
        const snap = await db.collection(name).where(field, '==', uid).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.size > 0) {
            await batch.commit();
        }
        report.push({ collection: name, deleted: snap.size });
    }
    // Conversas + mensagens.
    const conversations = await db
        .collection('conversations')
        .where('participants', 'array-contains', uid)
        .get();
    let removedMessages = 0;
    for (const conv of conversations.docs) {
        const msgs = await db
            .collection('conversation_messages')
            .where('conversation_id', '==', conv.id)
            .get();
        if (msgs.size > 0) {
            const batch = db.batch();
            msgs.docs.forEach((m) => batch.delete(m.ref));
            await batch.commit();
            removedMessages += msgs.size;
        }
        await conv.ref.delete();
    }
    report.push({ collection: 'conversations', deleted: conversations.size });
    report.push({ collection: 'conversation_messages', deleted: removedMessages });
    // Doc-id collections.
    const docCollections = [
        ...userCollections_1.USER_DATA_COLLECTIONS_BY_DOC_ID,
        ...(options.includeCompanyDoc ? userCollections_1.COMPANY_DATA_COLLECTIONS_BY_DOC_ID : []),
    ];
    for (const name of docCollections) {
        const ref = db.collection(name).doc(uid);
        const existing = await ref.get();
        if (existing.exists) {
            await ref.delete();
            report.push({ collection: name, deleted: 1 });
        }
        else {
            report.push({ collection: name, deleted: 0 });
        }
    }
    return report;
}
/**
 * T-08 (LGPD Art. 17): self-service delete imediato.
 * Cascade Firestore + audit + remove user do Firebase Auth.
 */
exports.deleteOwnAccount = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Login necessário.');
    }
    const db = (0, admin_1.getFirestore)();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Utilizador não encontrado.');
    }
    const role = userSnap.data()?.role ?? 'migrant';
    try {
        const report = await cascadeDeleteUserDataServer(db, uid, {
            includeCompanyDoc: role === 'company',
        });
        await db
            .collection('audit_logs')
            .doc(`selfdelete_${uid}_${Date.now()}`)
            .set({
            action: 'self_service_delete',
            actor_id: uid,
            target_id: uid,
            cascade_report: report,
            createdAt: new Date().toISOString(),
        });
        // Remove do Auth no fim — depois disto, sessões existentes deixam de validar.
        await (0, admin_1.getAdminApp)().auth().deleteUser(uid);
        firebase_functions_1.logger.info('self_service_delete_success', { uid, report });
        return { success: true, report };
    }
    catch (error) {
        const err = error;
        firebase_functions_1.logger.error('self_service_delete_failed', {
            uid,
            code: err.code ?? 'unknown',
            message: err.message ?? null,
        });
        throw new https_1.HttpsError('internal', 'Não foi possível eliminar a conta.', {
            error: 'SELF_DELETE_FAILED',
        });
    }
});
