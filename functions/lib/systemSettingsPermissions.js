"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canManageSystemSettings = canManageSystemSettings;
const admin_1 = require("./admin");
function normalizeRole(value) {
    if (typeof value !== 'string')
        return null;
    const role = value.trim().toLowerCase();
    if (!role)
        return null;
    if (role === 'administrador')
        return 'admin';
    if (role === 'gestor')
        return 'manager';
    return role;
}
async function canManageSystemSettings(uid) {
    const db = (0, admin_1.getFirestore)();
    const [userSnap, profileSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);
    const roleFrom = (data) => {
        if (!data)
            return null;
        return normalizeRole(data.role ?? data.profile ?? data.perfil ?? data.type);
    };
    const role = roleFrom(userSnap.exists ? userSnap.data() : undefined) ??
        roleFrom(profileSnap.exists ? profileSnap.data() : undefined);
    return role === 'admin' || role === 'manager';
}
