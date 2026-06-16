import {
  queryDocuments,
  deleteDocument,
  getDocument,
} from '@/integrations/firebase/firestore';
import {
  COMPANY_DATA_COLLECTIONS_BY_DOC_ID,
  USER_DATA_COLLECTIONS_BY_DOC_ID,
  USER_DATA_COLLECTIONS_BY_FIELD,
} from './userCollections';

export interface CascadeDeleteResult {
  collection: string;
  deleted: number;
}

interface ConversationDoc {
  id: string;
  participants?: string[] | null;
}

interface ConversationMessageDoc {
  id: string;
}

interface CascadeDeleteOptions {
  /**
   * Quando `true`, apaga também `companies/{uid}`. Não acionar para
   * migrantes (não têm doc nessa collection).
   */
  includeCompanyDoc?: boolean;
}

/**
 * Apaga TODOS os dados de utilizador associados a `uid` em todas as
 * collections conhecidas. Devolve relatório granular por collection
 * para auditoria. Não toca em `audit_logs` nem em outros registos
 * históricos.
 */
export async function cascadeDeleteUserData(
  uid: string,
  options: CascadeDeleteOptions = {}
): Promise<CascadeDeleteResult[]> {
  const report: CascadeDeleteResult[] = [];

  for (const { name, field } of USER_DATA_COLLECTIONS_BY_FIELD) {
    const docs = await queryDocuments<{ id: string }>(name, [
      { field, operator: '==', value: uid },
    ]);
    for (const d of docs) {
      await deleteDocument(name, d.id);
    }
    report.push({ collection: name, deleted: docs.length });
  }

  // Conversas: o uid aparece em `participants` (array-contains).
  const conversations = await queryDocuments<ConversationDoc>('conversations', [
    { field: 'participants', operator: 'array-contains', value: uid },
  ]);
  let removedMessages = 0;
  for (const conv of conversations) {
    const messages = await queryDocuments<ConversationMessageDoc>(
      'conversation_messages',
      [{ field: 'conversation_id', operator: '==', value: conv.id }]
    );
    for (const m of messages) {
      await deleteDocument('conversation_messages', m.id);
      removedMessages += 1;
    }
    await deleteDocument('conversations', conv.id);
  }
  report.push({ collection: 'conversations', deleted: conversations.length });
  report.push({ collection: 'conversation_messages', deleted: removedMessages });

  // Doc-id collections (existence-check antes de tentar apagar para evitar erros).
  const docCollections: string[] = [
    ...USER_DATA_COLLECTIONS_BY_DOC_ID,
    ...(options.includeCompanyDoc ? COMPANY_DATA_COLLECTIONS_BY_DOC_ID : []),
  ];
  for (const name of docCollections) {
    const existing = await getDocument<{ id: string }>(name, uid);
    if (existing) {
      await deleteDocument(name, uid);
      report.push({ collection: name, deleted: 1 });
    } else {
      report.push({ collection: name, deleted: 0 });
    }
  }

  return report;
}
