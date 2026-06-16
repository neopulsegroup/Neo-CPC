import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: () => () => undefined,
  HttpsError: class extends Error {
    code: string;
    details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));
vi.mock('./admin', () => ({
  getAdminApp: () => ({ auth: () => ({ deleteUser: vi.fn() }) }),
  getFirestore: () => ({}),
}));

import { cascadeDeleteUserDataServer } from './deleteOwnAccount';

function makeDocSnap(id: string) {
  return { id, ref: { delete: vi.fn().mockResolvedValue(undefined) }, exists: true };
}

function makeBatch() {
  return { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
}

function buildFakeDb(seed: {
  byField: Record<string, Array<{ id: string }>>;
  conversations: Array<{ id: string }>;
  conversationMessages: Record<string, Array<{ id: string }>>;
  docExists: Record<string, boolean>;
}) {
  const batches: ReturnType<typeof makeBatch>[] = [];
  const docDeletes: string[] = [];

  function fakeCollection(name: string) {
    return {
      where(field: string, _op: string, value: unknown) {
        void field;
        void value;
        if (name === 'conversations') {
          return {
            get: async () => ({
              size: seed.conversations.length,
              docs: seed.conversations.map((c) => ({
                id: c.id,
                ref: { delete: vi.fn().mockResolvedValue(undefined) },
              })),
            }),
          };
        }
        if (name === 'conversation_messages') {
          // Filtra por conversation_id (passado no value).
          const convId = value as string;
          const msgs = seed.conversationMessages[convId] ?? [];
          return {
            get: async () => ({
              size: msgs.length,
              docs: msgs.map((m) => ({ id: m.id, ref: { delete: vi.fn() } })),
            }),
          };
        }
        const docs = (seed.byField[name] ?? []).map((d) => makeDocSnap(d.id));
        return {
          get: async () => ({ size: docs.length, docs }),
        };
      },
      doc(id: string) {
        return {
          get: async () => ({ exists: !!seed.docExists[`${name}/${id}`] }),
          delete: async () => {
            docDeletes.push(`${name}/${id}`);
          },
        };
      },
    };
  }

  return {
    db: {
      collection: fakeCollection,
      batch: () => {
        const b = makeBatch();
        batches.push(b);
        return b;
      },
    },
    batches,
    docDeletes,
  };
}

describe('cascadeDeleteUserDataServer', () => {
  it('faz cascade em todas as field-collections e nos doc-id collections', async () => {
    const fake = buildFakeDb({
      byField: {
        sessions: [{ id: 's1' }, { id: 's2' }],
        user_trail_progress: [{ id: 'p1' }],
        job_applications: [],
        notifications: [{ id: 'n1' }],
      },
      conversations: [{ id: 'c1' }],
      conversationMessages: { c1: [{ id: 'm1' }, { id: 'm2' }] },
      docExists: {
        'profiles/u1': true,
        'triage/u1': true,
        'users/u1': true,
      },
    });

    const report = await cascadeDeleteUserDataServer(
      fake.db as unknown as FirebaseFirestore.Firestore,
      'u1'
    );

    const map = Object.fromEntries(report.map((r) => [r.collection, r.deleted]));
    expect(map).toMatchObject({
      sessions: 2,
      user_trail_progress: 1,
      job_applications: 0,
      notifications: 1,
      conversations: 1,
      conversation_messages: 2,
      profiles: 1,
      triage: 1,
      users: 1,
    });

    // Doc-id deletes registados.
    expect(fake.docDeletes).toEqual(expect.arrayContaining([
      'profiles/u1',
      'triage/u1',
      'users/u1',
    ]));
    expect(fake.docDeletes).not.toContain('companies/u1');
  });

  it('com includeCompanyDoc=true também apaga companies/{uid}', async () => {
    const fake = buildFakeDb({
      byField: {
        sessions: [],
        user_trail_progress: [],
        job_applications: [],
        notifications: [],
      },
      conversations: [],
      conversationMessages: {},
      docExists: {
        'profiles/c1': false,
        'triage/c1': false,
        'users/c1': true,
        'companies/c1': true,
      },
    });

    const report = await cascadeDeleteUserDataServer(
      fake.db as unknown as FirebaseFirestore.Firestore,
      'c1',
      { includeCompanyDoc: true }
    );

    expect(fake.docDeletes).toContain('companies/c1');
    expect(report.find((r) => r.collection === 'companies')?.deleted).toBe(1);
  });
});
