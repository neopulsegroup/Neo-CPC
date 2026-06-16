"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_STORAGE_BUCKET = exports.FIREBASE_STORAGE_BUCKET = void 0;
exports.getAdminApp = getAdminApp;
exports.getFirestore = getFirestore;
exports.getStorageBucket = getStorageBucket;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.FIREBASE_STORAGE_BUCKET = 'cpc-projeto-app.firebasestorage.app';
exports.LEGACY_STORAGE_BUCKET = 'cpc-projeto-app.appspot.com';
let app = null;
function getAdminApp() {
    if (app)
        return app;
    try {
        app = firebase_admin_1.default.app();
        return app;
    }
    catch {
        app = firebase_admin_1.default.initializeApp({
            storageBucket: exports.FIREBASE_STORAGE_BUCKET,
        });
        return app;
    }
}
function getFirestore() {
    return getAdminApp().firestore();
}
function getStorageBucket(bucketName = exports.FIREBASE_STORAGE_BUCKET) {
    return getAdminApp().storage().bucket(bucketName);
}
