"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminApp = getAdminApp;
exports.getFirestore = getFirestore;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
let app = null;
function getAdminApp() {
    if (app)
        return app;
    app = firebase_admin_1.default.apps.length > 0 ? firebase_admin_1.default.app() : firebase_admin_1.default.initializeApp();
    return app;
}
function getFirestore() {
    return firebase_admin_1.default.firestore(getAdminApp());
}
