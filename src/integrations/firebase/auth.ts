import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './client';
import { functions } from './functionsClient';
import { getRecaptchaToken } from '@/lib/recaptcha';
import { resolvePasswordResetContinueUrl } from '@/lib/passwordResetContinueUrl';
const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;

export interface UserProfile {
    email: string;
    name: string;
    role: 'migrant' | 'company' | 'admin' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'trainer';
    nif?: string;
    active?: boolean | null;
    disabledAt?: unknown | null;
    blocked?: boolean | null;
    blockedAt?: unknown | null;
    blockedBy?: string | null;
    createdAt: unknown;
    updatedAt: unknown;
}

function normalizeRole(role: unknown): UserProfile['role'] {
    if (typeof role !== 'string') return role as UserProfile['role'];
    const v = role.toLowerCase();
    const allowed: Array<UserProfile['role']> = ['migrant', 'company', 'admin', 'mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'trainer'];
    return (allowed.includes(v as UserProfile['role']) ? v : role) as UserProfile['role'];
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.length > 0) {
            return message;
        }
    }
    return fallback;
}

function getFirebaseAuthCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
}

function mapRegisterAuthError(error: unknown): string {
    if (error && typeof error === 'object' && 'details' in error) {
        const details = (error as { details?: unknown }).details;
        if (details && typeof details === 'object' && 'error' in details) {
            const code = (details as { error?: unknown }).error;
            if (typeof code === 'string' && code.trim()) return code;
        }
    }
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: unknown }).code;
        if (typeof code === 'string' && code.startsWith('functions/')) {
            if (code === 'functions/already-exists') return 'USER_ALREADY_EXISTS';
            if (code === 'functions/resource-exhausted') return 'RATE_LIMITED';
            if (code === 'functions/invalid-argument') return 'VALIDATION_FAILED';
            if (code === 'functions/failed-precondition') return 'CAPTCHA_REQUIRED';
            if (code === 'functions/permission-denied') return 'REGISTER_FAILED';
            if (code === 'functions/unavailable') return 'AUTH_PROVIDER_UNAVAILABLE';
            if (code === 'functions/internal') return 'REGISTER_FAILED';
        }
    }
    const code = getFirebaseAuthCode(error);
    if (code === 'auth/email-already-in-use') return 'USER_ALREADY_EXISTS';
    if (code === 'auth/weak-password') return 'WEAK_PASSWORD';
    if (code === 'auth/network-request-failed') return 'NETWORK_ERROR';
    if (code === 'auth/too-many-requests') return 'RATE_LIMITED';
    if (code === 'auth/internal-error' || code === 'auth/app-not-authorized') return 'AUTH_PROVIDER_UNAVAILABLE';
    return 'REGISTER_FAILED';
}

function mapLoginAuthError(error: unknown): string {
    const code = getFirebaseAuthCode(error);
    if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        return 'INVALID_CREDENTIALS';
    }
    if (code === 'auth/network-request-failed') return 'NETWORK_ERROR';
    if (code === 'auth/too-many-requests') return 'RATE_LIMITED';
    if (code === 'auth/internal-error' || code === 'auth/app-not-authorized') return 'AUTH_PROVIDER_UNAVAILABLE';
    return 'LOGIN_FAILED';
}

function isFunctionFallbackEligible(error: unknown): boolean {
    const code = getFirebaseAuthCode(error) ?? '';
    if (code === 'functions/internal' || code === 'functions/unavailable' || code === 'functions/unknown') {
        return true;
    }
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
        message.includes('cors') ||
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('preflight') ||
        message.includes('internal')
    );
}

async function registerUserWithClientFallback(
    email: string,
    password: string,
    name: string,
    role: UserProfile['role'],
    additionalData?: { nif?: string; activityArea?: string }
) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const now = serverTimestamp();
    const userProfile: UserProfile = {
        email,
        name,
        role,
        active: true,
        disabledAt: null,
        blocked: false,
        blockedAt: null,
        blockedBy: null,
        createdAt: now,
        updatedAt: now,
        ...(additionalData?.nif && { nif: additionalData.nif }),
    };

    try {
        await setDoc(doc(db, 'users', uid), userProfile);
        await setDoc(
            doc(db, 'profiles', uid),
            {
                name,
                email,
                role,
                phone: null,
                birthDate: null,
                nationality: null,
                photoUrl: null,
                currentLocation: null,
                arrivalDate: null,
                registeredAt: now,
                updatedAt: now,
            },
            { merge: true }
        );

        if (role === 'company') {
            // TASK-05: persiste activity_area (snake_case na DB; matches CompanyDashboard read).
            const activityAreaForDb =
                typeof additionalData?.activityArea === 'string' && additionalData.activityArea.trim()
                    ? additionalData.activityArea.trim()
                    : null;
            await setDoc(
                doc(db, 'companies', uid),
                {
                    user_id: uid,
                    company_name: name,
                    verified: false,
                    createdAt: now,
                    updatedAt: now,
                    ...(activityAreaForDb ? { activity_area: activityAreaForDb } : {}),
                },
                { merge: true }
            );
        }
    } catch (writeError) {
        try {
            await userCredential.user.delete();
        } catch {
            // Ignora rollback falhado para não mascarar o erro original.
        }
        throw writeError;
    }

    return { user: userCredential.user, profile: userProfile };
}

function useSecureRegisterFunction(): boolean {
    return String(env.VITE_USE_SECURE_REGISTER_FUNCTION ?? 'false').toLowerCase() === 'true';
}

/**
 * Register a new user with email and password
 */
export async function registerUser(
    email: string,
    password: string,
    name: string,
    role: 'migrant' | 'company' | 'admin' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'trainer' = 'migrant',
    additionalData?: { nif?: string; activityArea?: string }
) {
    try {
        const callRegister = httpsCallable<
            {
                email: string;
                password: string;
                name: string;
                role: UserProfile['role'];
                nif?: string;
                activityArea?: string;
                captchaToken?: string;
            },
            { ok: boolean; requestId?: string }
        >(functions, 'registerUserSecure');

        if (!useSecureRegisterFunction()) {
            return await registerUserWithClientFallback(email, password, name, role, additionalData);
        }

        try {
            const captchaToken = await getRecaptchaToken('register');

            await callRegister({
                email,
                password,
                name,
                role,
                ...(captchaToken ? { captchaToken } : {}),
                ...(additionalData?.nif ? { nif: additionalData.nif } : {}),
                ...(additionalData?.activityArea ? { activityArea: additionalData.activityArea } : {}),
            });
        } catch (functionError) {
            if (!isFunctionFallbackEligible(functionError)) {
                throw functionError;
            }
            console.warn('registerUserSecure indisponível. A usar fallback de cadastro no cliente.');
            return await registerUserWithClientFallback(email, password, name, role, additionalData);
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const profile = await getUserProfile(user.uid);
        const userProfile: UserProfile = profile ?? {
            email,
            name,
            role,
            active: true,
            disabledAt: null,
            blocked: false,
            blockedAt: null,
            blockedBy: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(additionalData?.nif && { nif: additionalData.nif }),
        };
        return { user, profile: userProfile };
    } catch (error: unknown) {
        console.error('Error registering user:', error);
        throw new Error(mapRegisterAuthError(error));
    }
}

/**
 * Sign in user with email and password
 */
export async function loginUser(email: string, password: string) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error: unknown) {
        console.error('Error logging in:', error);
        throw new Error(mapLoginAuthError(error));
    }
}

/**
 * Sign out current user
 */
export async function logoutUser() {
    try {
        await signOut(auth);
    } catch (error: unknown) {
        console.error('Error logging out:', error);
        throw new Error(getErrorMessage(error, 'Error logging out'));
    }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new Error('Email inválido.');

    const continueUrl = resolvePasswordResetContinueUrl();

    try {
        await sendPasswordResetEmail(auth, normalized, { url: continueUrl });
    } catch (error: unknown) {
        console.error('Error sending password reset email:', error);
        throw new Error(getErrorMessage(error, 'Error sending password reset email'));
    }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data() as Record<string, unknown>;
            return { ...(data as UserProfile), role: normalizeRole(data.role) };
        }
        return null;
    } catch (error: unknown) {
        console.error('Error getting user profile:', error);
        throw new Error(getErrorMessage(error, 'Error getting user profile'));
    }
}

/**
 * Update user profile in Firestore
 */
export async function updateUserProfile(userId: string, data: Partial<UserProfile>) {
    try {
        await updateDoc(doc(db, 'users', userId), {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (error: unknown) {
        console.error('Error updating user profile:', error);
        throw new Error(getErrorMessage(error, 'Error updating user profile'));
    }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
    return auth.currentUser;
}
