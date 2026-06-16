import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * T-31 (staging): config Firebase ler de `import.meta.env.VITE_FIREBASE_*`
 * com fallback para os valores actuais de produção. Enquanto o projeto de
 * staging não existe, os fallbacks garantem que produção continua igual.
 * Documentação: `docs/STAGING.md`.
 */
const envConfig = import.meta.env as unknown as Record<string, string | undefined>;
const firebaseConfig = {
    apiKey: envConfig.VITE_FIREBASE_API_KEY || "AIzaSyDNGGwJcCBoMHPXPY-J4pMcOOtVRQPevaM",
    authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN || "cpc-projeto-app.firebaseapp.com",
    projectId: envConfig.VITE_FIREBASE_PROJECT_ID || "cpc-projeto-app",
    storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET || "cpc-projeto-app.firebasestorage.app",
    messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID || "936471221499",
    appId: envConfig.VITE_FIREBASE_APP_ID || "1:936471221499:web:32a84776ac9f78afb58c5e",
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
