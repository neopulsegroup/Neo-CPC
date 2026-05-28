import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getCountFromServer,
    serverTimestamp,
    Timestamp,
    WhereFilterOp,
} from 'firebase/firestore';
import { db } from './client';
import { auth } from './client';

type FirestoreLikeError = { code?: unknown; message?: unknown };

function getFirestoreErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const code = (error as FirestoreLikeError).code;
    return typeof code === 'string' ? code : null;
}

function isRetryableFirestoreError(error: unknown): boolean {
    const code = getFirestoreErrorCode(error);
    return code === 'unavailable' || code === 'deadline-exceeded' || code === 'resource-exhausted' || code === 'internal';
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(action: () => Promise<T>, attempts: number = 3): Promise<T> {
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await action();
        } catch (error) {
            lastError = error;
            const code = getFirestoreErrorCode(error);
            if (code === 'permission-denied' && auth.currentUser && i === 0) {
                try {
                    await auth.currentUser.getIdToken(true);
                    await sleep(150);
                    continue;
                } catch {
                    throw error;
                }
            }
            if (!isRetryableFirestoreError(error) || i === attempts - 1) {
                throw error;
            }
            const backoffMs = 250 * Math.pow(2, i);
            await sleep(backoffMs);
        }
    }
    throw lastError;
}

/**
 * Generic function to get a document from Firestore
 */
export async function getDocument<T>(collectionName: string, documentId: string): Promise<T | null> {
    try {
        const docRef = doc(db, collectionName, documentId);
        const docSnap = await withRetry(() => getDoc(docRef));

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as T;
        }
        return null;
    } catch (error) {
        const code = getFirestoreErrorCode(error);
        console.error(`Error getting document from ${collectionName}:`, {
            code,
            uid: auth.currentUser?.uid ?? null,
            hasAuth: !!auth.currentUser,
            error,
        });
        throw error;
    }
}

/**
 * Generic function to set/create a document in Firestore
 */
export async function setDocument<T>(
    collectionName: string,
    documentId: string,
    data: T,
    merge: boolean = false
) {
    try {
        const docRef = doc(db, collectionName, documentId);
        console.log(`[firestore.setDocument] write start: ${collectionName}/${documentId}`);
        await setDoc(docRef, data, { merge });
        console.log(`[firestore.setDocument] write ack: ${collectionName}/${documentId}`);
    } catch (error) {
        console.error(`Error setting document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to update a document in Firestore
 */
export async function updateDocument(
    collectionName: string,
    documentId: string,
    data: Record<string, unknown>
) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error(`Error updating document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to delete a document from Firestore
 */
export async function deleteDocument(collectionName: string, documentId: string) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error(`Error deleting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to get all documents from a collection
 */
export async function getCollection<T>(collectionName: string): Promise<T[]> {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
        console.error(`Error getting collection ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to add a document with an auto-generated id
 */
export async function addDocument<T>(collectionName: string, data: T): Promise<string> {
    try {
        const docRef = await withRetry(() =>
            addDoc(collection(db, collectionName), data as unknown as Record<string, unknown>)
        );
        return docRef.id;
    } catch (error) {
        console.error(`Error adding document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Count documents with optional filters (server-side count aggregation)
 */
export async function countDocuments(
    collectionName: string,
    filters: { field: string; operator: WhereFilterOp; value: unknown }[] = []
): Promise<number> {
    try {
        let q = query(collection(db, collectionName));
        filters.forEach(filter => {
            q = query(q, where(filter.field, filter.operator, filter.value));
        });
        const snap = await withRetry(() => getCountFromServer(q));
        return snap.data().count;
    } catch (error) {
        const code = getFirestoreErrorCode(error);
        console.error(`Error counting ${collectionName}:`, {
            code,
            uid: auth.currentUser?.uid ?? null,
            hasAuth: !!auth.currentUser,
            error,
        });
        throw error;
    }
}

/**
 * Query documents with filters
 */
export async function queryDocuments<T>(
    collectionName: string,
    filters: { field: string; operator: WhereFilterOp; value: unknown }[],
    orderByField?: string | { field: string; direction?: 'asc' | 'desc' },
    limitCount?: number,
    startAfterValues?: unknown[]
): Promise<T[]> {
    try {
        let q = query(collection(db, collectionName));

        // Apply filters
        filters.forEach(filter => {
            q = query(q, where(filter.field, filter.operator, filter.value));
        });

        // Apply ordering
        if (orderByField) {
            if (typeof orderByField === 'string') {
                q = query(q, orderBy(orderByField));
            } else {
                q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
            }
        }

        // Apply limit
        if (limitCount) {
            q = query(q, limit(limitCount));
        }

        if (startAfterValues && startAfterValues.length > 0) {
            q = query(q, startAfter(...startAfterValues));
        }

        const querySnapshot = await withRetry(() => getDocs(q));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
        const code = getFirestoreErrorCode(error);
        console.error(`Error querying ${collectionName}:`, {
            code,
            uid: auth.currentUser?.uid ?? null,
            hasAuth: !!auth.currentUser,
            error,
        });
        throw error;
    }
}

export function subscribeQuery<T>(args: {
    collectionName: string;
    filters: { field: string; operator: WhereFilterOp; value: unknown }[];
    orderByField?: string | { field: string; direction?: 'asc' | 'desc' };
    limitCount?: number;
    onNext: (docs: T[]) => void;
    onError?: (error: unknown) => void;
}): () => void {
    const { collectionName, filters, orderByField, limitCount, onNext, onError } = args;
    let q = query(collection(db, collectionName));

    filters.forEach((filter) => {
        q = query(q, where(filter.field, filter.operator, filter.value));
    });

    if (orderByField) {
        if (typeof orderByField === 'string') {
            q = query(q, orderBy(orderByField));
        } else {
            q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
        }
    }

    if (limitCount) {
        q = query(q, limit(limitCount));
    }

    return onSnapshot(
        q,
        (snap) => {
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
            onNext(docs);
        },
        (error) => {
            console.error(`Error subscribing ${collectionName}:`, {
                code: getFirestoreErrorCode(error),
                uid: auth.currentUser?.uid ?? null,
                hasAuth: !!auth.currentUser,
                error,
            });
            onError?.(error);
        }
    );
}

export function subscribeDocument<T>(args: {
    collectionName: string;
    documentId: string;
    onNext: (doc: T | null) => void;
    onError?: (error: unknown) => void;
}): () => void {
    const { collectionName, documentId, onNext, onError } = args;
    const docRef = doc(db, collectionName, documentId);
    return onSnapshot(
        docRef,
        (snap) => {
            if (!snap.exists()) {
                onNext(null);
                return;
            }
            onNext({ id: snap.id, ...snap.data() } as T);
        },
        (error) => {
            console.error(`Error subscribing doc ${collectionName}/${documentId}:`, {
                code: getFirestoreErrorCode(error),
                uid: auth.currentUser?.uid ?? null,
                hasAuth: !!auth.currentUser,
                error,
            });
            onError?.(error);
        }
    );
}

/**
 * Helper to convert Firestore Timestamp to Date
 */
export function timestampToDate(timestamp: Timestamp | null): Date | null {
    if (!timestamp) return null;
    return timestamp.toDate();
}

/**
 * Helper to get server timestamp
 */
export { serverTimestamp };
