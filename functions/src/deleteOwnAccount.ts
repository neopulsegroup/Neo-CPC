import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { getAdminApp, getFirestore } from './admin';
import {
  COMPANY_DATA_COLLECTIONS_BY_DOC_ID,
  USER_DATA_COLLECTIONS_BY_DOC_ID,
  USER_DATA_COLLECTIONS_BY_FIELD,
} from './lib/userCollections';

export interface CascadeReportEntry {
  collection: string;
  deleted: number;
}

/** Cascade-delete server-side de todos os dados de um utilizador. */
export async function cascadeDeleteUserDataServer(
  db: FirebaseFirestore.Firestore,
  uid: string,
  options: { includeCompanyDoc?: boolean } = {}
): Promise<CascadeReportEntry[]> {
  const report: CascadeReportEntry[] = [];

  for (const { name, field } of USER_DATA_COLLECTIONS_BY_FIELD) {
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
  const docCollections: string[] = [
    ...USER_DATA_COLLECTIONS_BY_DOC_ID,
    ...(options.includeCompanyDoc ? COMPANY_DATA_COLLECTIONS_BY_DOC_ID : []),
  ];
  for (const name of docCollections) {
    const ref = db.collection(name).doc(uid);
    const existing = await ref.get();
    if (existing.exists) {
      await ref.delete();
      report.push({ collection: name, deleted: 1 });
    } else {
      report.push({ collection: name, deleted: 0 });
    }
  }

  return report;
}

/**
 * T-08 (LGPD Art. 17): self-service delete imediato.
 * Cascade Firestore + audit + remove user do Firebase Auth.
 */
export const deleteOwnAccount = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login necessário.');
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'Utilizador não encontrado.');
    }
    const role = (userSnap.data()?.role as string | undefined) ?? 'migrant';

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
      await getAdminApp().auth().deleteUser(uid);

      logger.info('self_service_delete_success', { uid, report });
      return { success: true, report };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      logger.error('self_service_delete_failed', {
        uid,
        code: err.code ?? 'unknown',
        message: err.message ?? null,
      });
      throw new HttpsError('internal', 'Não foi possível eliminar a conta.', {
        error: 'SELF_DELETE_FAILED',
      });
    }
  }
);
