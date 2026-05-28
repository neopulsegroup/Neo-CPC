import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDNGGwJcCBoMHPXPY-J4pMcOOtVRQPevaM",
    authDomain: "cpc-projeto-app.firebaseapp.com",
    projectId: "cpc-projeto-app",
    storageBucket: "cpc-projeto-app.firebasestorage.app",
    messagingSenderId: "936471221499",
    appId: "1:936471221499:web:32a84776ac9f78afb58c5e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const appCheckSiteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (typeof appCheckSiteKey === "string" && appCheckSiteKey.length > 0) {
    const globalAny = globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string };
    if (env.DEV === true) {
        globalAny.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
    });
}

// Initialize Firebase services with settings optimized for stability
// Using experimentalForceLongPolling to avoid network issues with WebSockets in some environments
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true,
});

const USE_EMULATOR = String(env.VITE_USE_EMULATOR || env.VITE_FUNCTIONS_EMULATOR) === 'true';

if (env.DEV === true && USE_EMULATOR) {
    const host = (env.VITE_FIRESTORE_EMULATOR_HOST as string) || "localhost";
    const port = Number(env.VITE_FIRESTORE_EMULATOR_PORT || 8082);
    connectFirestoreEmulator(db, host, port);
}

export const auth = getAuth(app);
export const storage = getStorage(app);

if (env.DEV === true && USE_EMULATOR) {
    const host = (env.VITE_AUTH_EMULATOR_HOST as string) || "localhost";
    const port = Number(env.VITE_AUTH_EMULATOR_PORT || 9099);
    connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true });
    console.info('[firebase] usando emuladores locais', { host, port });
} else if (env.DEV === true) {
    console.info('[firebase] a usar Firebase de produção (emulador desativado)');
}

export default app;
