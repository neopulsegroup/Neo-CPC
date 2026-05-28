"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdminUser = isAdminUser;
const admin_1 = require("./admin");
async function isAdminUser(uid) {
    const db = (0, admin_1.getFirestore)();
    const [userSnap, profileSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);
    const roleFrom = (data) => {
        if (!data)
            return null;
        const raw = data.role ?? data.profile ?? data.perfil ?? data.type;
        return typeof raw === 'string' ? raw.toLowerCase() : null;
    };
    const role = roleFrom(userSnap.exists ? userSnap.data() : undefined) ?? roleFrom(profileSnap.exists ? profileSnap.data() : undefined);
    if (!role)
        return false;
    if (role === 'admin' || role === 'administrador')
        return true;
    if (role === 'cpc' || role === 'team' || role === 'staff' || role === 'equipa')
        return true;
    return false;
}
