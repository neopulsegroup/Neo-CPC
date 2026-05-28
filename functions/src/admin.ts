import admin from 'firebase-admin';

let app: admin.app.App | null = null;

export function getAdminApp() {
  if (app) return app;
  app = admin.apps.length > 0 ? admin.app() : admin.initializeApp();
  return app;
}

export function getFirestore() {
  return admin.firestore(getAdminApp());
}

