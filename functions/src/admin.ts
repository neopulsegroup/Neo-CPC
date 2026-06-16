import admin from 'firebase-admin';

export const FIREBASE_STORAGE_BUCKET = 'cpc-projeto-app.firebasestorage.app';
export const LEGACY_STORAGE_BUCKET = 'cpc-projeto-app.appspot.com';

let app: admin.app.App | null = null;

export function getAdminApp(): admin.app.App {
  if (app) return app;

  try {
    app = admin.app();
    return app;
  } catch {
    app = admin.initializeApp({
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
    return app;
  }
}

export function getFirestore() {
  return getAdminApp().firestore();
}

export function getStorageBucket(bucketName = FIREBASE_STORAGE_BUCKET) {
  return getAdminApp().storage().bucket(bucketName);
}
