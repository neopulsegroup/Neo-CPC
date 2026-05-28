import { createHash, randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import admin from 'firebase-admin';

import { getAdminApp, getFirestore } from './admin';

type RegisterRole =
  | 'migrant'
  | 'company'
  | 'admin'
  | 'mediator'
  | 'lawyer'
  | 'psychologist'
  | 'manager'
  | 'coordinator'
  | 'trainer';

type RegisterPayload = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  role?: unknown;
  nif?: unknown;
  /**
   * TASK-05: área de atividade obrigatória quando role === 'company'.
   * Espera-se a label já resolvida (ex.: "Construção" ou texto livre se
   * o utilizador escolheu "Outro"). Persistido em `companies.activity_area`.
   */
  activityArea?: unknown;
  captchaToken?: unknown;
};

const ALLOWED_ROLES: RegisterRole[] = [
  'migrant',
  'company',
  'admin',
  'mediator',
  'lawyer',
  'psychologist',
  'manager',
  'coordinator',
  'trainer',
];
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 8;

/** Origens permitidas no browser (callable Gen2 + Cloud Run). Incluir domínio de produção e emuladores locais. */
const REGISTER_CORS_ORIGINS: Array<string | RegExp> = [
  'https://www.portalcpc.com',
  'https://portalcpc.com',
  'https://cpc-projeto-app.web.app',
  'https://cpc-projeto-app.firebaseapp.com',
  'https://saas-cpc.vercel.app',
  /^https:\/\/[\w-]+\.portalcpc\.com$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

function getClientIp(rawRequest: { headers?: Record<string, unknown>; ip?: string | undefined }): string {
  const forwarded = rawRequest.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || rawRequest.ip || 'unknown';
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  return rawRequest.ip || 'unknown';
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(value: unknown): RegisterRole {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (ALLOWED_ROLES.includes(role as RegisterRole)) {
    return role as RegisterRole;
  }
  return 'migrant';
}

function normalizePassword(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeNif(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const onlyDigits = value.replace(/\D/g, '');
  return onlyDigits.length > 0 ? onlyDigits : null;
}

function normalizeActivityArea(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  // Limita tamanho para evitar abuso (label de área não deve passar disso).
  return trimmed.slice(0, 120);
}

async function assertRateLimit(ip: string, email: string, requestId: string) {
  const db = getFirestore();
  const bucket = `reg:${hashValue(ip)}:${hashValue(email || 'unknown')}`;
  const ref = db.collection('security_rate_limits').doc(bucket);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : now;
    const blockedUntil = typeof data?.blockedUntil === 'number' ? data.blockedUntil : 0;
    const attempts = typeof data?.attempts === 'number' ? data.attempts : 0;

    if (blockedUntil > now) {
      logger.warn('register_rate_limited_blocked', { requestId, bucket, blockedUntil });
      throw new HttpsError('resource-exhausted', 'Não foi possível concluir o cadastro.', {
        error: 'RATE_LIMITED',
        requestId,
      });
    }

    const inWindow = now - windowStart <= RATE_LIMIT_WINDOW_MS;
    const nextAttempts = inWindow ? attempts + 1 : 1;
    const nextWindow = inWindow ? windowStart : now;

    if (nextAttempts > RATE_LIMIT_MAX_ATTEMPTS) {
      const nextBlockedUntil = now + RATE_LIMIT_WINDOW_MS;
      tx.set(
        ref,
        {
          attempts: nextAttempts,
          windowStart: nextWindow,
          blockedUntil: nextBlockedUntil,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      logger.warn('register_rate_limited_triggered', { requestId, bucket, nextAttempts, nextBlockedUntil });
      throw new HttpsError('resource-exhausted', 'Não foi possível concluir o cadastro.', {
        error: 'RATE_LIMITED',
        requestId,
      });
    }

    tx.set(
      ref,
      {
        attempts: nextAttempts,
        windowStart: nextWindow,
        blockedUntil: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function verifyCaptchaIfConfigured(captchaToken: unknown, requestId: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return;

  const token = typeof captchaToken === 'string' ? captchaToken.trim() : '';
  if (!token) {
    throw new HttpsError('failed-precondition', 'Não foi possível concluir o cadastro.', {
      error: 'CAPTCHA_REQUIRED',
      requestId,
    });
  }

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    logger.error('captcha_http_error', { requestId, status: response.status });
    throw new HttpsError('unavailable', 'Não foi possível concluir o cadastro.', {
      error: 'AUTH_PROVIDER_UNAVAILABLE',
      requestId,
    });
  }

  const body = (await response.json()) as { success?: boolean; score?: number };
  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  const score = typeof body.score === 'number' ? body.score : 0;

  if (!body.success || score < minScore) {
    logger.warn('captcha_failed', { requestId, score, minScore });
    throw new HttpsError('permission-denied', 'Não foi possível concluir o cadastro.', {
      error: 'REGISTRATION_FAILED',
      requestId,
    });
  }
}

function validatePayload(payload: RegisterPayload, requestId: string) {
  const email = normalizeEmail(payload.email);
  const name = normalizeName(payload.name);
  const password = normalizePassword(payload.password);
  const role = normalizeRole(payload.role);
  const nif = normalizeNif(payload.nif);
  const activityArea = normalizeActivityArea(payload.activityArea);

  if (!email || !name || !password) {
    throw new HttpsError('invalid-argument', 'Não foi possível concluir o cadastro.', {
      error: 'VALIDATION_FAILED',
      requestId,
    });
  }

  if (!email.includes('@') || email.length > 254 || name.length < 2 || name.length > 120 || password.length < 6 || password.length > 72) {
    throw new HttpsError('invalid-argument', 'Não foi possível concluir o cadastro.', {
      error: 'VALIDATION_FAILED',
      requestId,
    });
  }

  if (role === 'company' && (!nif || nif.length < 9)) {
    throw new HttpsError('invalid-argument', 'Não foi possível concluir o cadastro.', {
      error: 'VALIDATION_FAILED',
      requestId,
    });
  }

  // TASK-05: activity_area obrigatória para empresa (mín. 2 chars).
  if (role === 'company' && (!activityArea || activityArea.length < 2)) {
    throw new HttpsError('invalid-argument', 'Não foi possível concluir o cadastro.', {
      error: 'VALIDATION_FAILED',
      requestId,
    });
  }

  return { email, name, password, role, nif, activityArea };
}

export const registerUserSecure = onCall(
  {
    region: 'us-central1',
    /**
     * Registo corre antes de existir sessão Firebase: o serviço Cloud Run subjacente tem de permitir invocação pública.
     * Sem isto, o preflight OPTIONS pode falhar e o browser reporta erro de CORS.
     */
    invoker: 'public',
    cors: REGISTER_CORS_ORIGINS,
    enforceAppCheck: process.env.ENFORCE_APPCHECK === 'true',
  },
  async (request) => {
    const requestId = randomUUID();
    const rawRequest = request.rawRequest;
    const payload = (request.data || {}) as RegisterPayload;
    const ip = getClientIp(rawRequest);

    try {
      const { email, name, password, role, nif, activityArea } = validatePayload(payload, requestId);
      await assertRateLimit(ip, email, requestId);
      await verifyCaptchaIfConfigured(payload.captchaToken, requestId);

      const auth = getAdminApp().auth();
      const created = await auth.createUser({
        email,
        password,
        displayName: name,
      });

      const db = getFirestore();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const userDoc = {
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
        ...(nif ? { nif } : {}),
      };
      const profileDoc = {
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
      };

      const batch = db.batch();
      batch.set(db.doc(`users/${created.uid}`), userDoc, { merge: false });
      batch.set(db.doc(`profiles/${created.uid}`), profileDoc, { merge: true });
      if (role === 'company') {
        batch.set(
          db.doc(`companies/${created.uid}`),
          {
            user_id: created.uid,
            company_name: name,
            verified: false,
            createdAt: now,
            updatedAt: now,
            // TASK-05: snake_case na DB para alinhar com leitura no CompanyDashboard.
            ...(activityArea ? { activity_area: activityArea } : {}),
          },
          { merge: true }
        );
      }
      await batch.commit();

      logger.info('register_success', { requestId, uid: created.uid, role });
      return { ok: true, requestId };
    } catch (error: unknown) {
      if (error instanceof HttpsError) {
        logger.warn('register_failed_known', {
          requestId,
          code: error.code,
          details: error.details,
        });
        throw error;
      }

      const err = error as { code?: string; message?: string };
      const providerCode = typeof err.code === 'string' ? err.code : 'unknown';
      logger.error('register_failed_unexpected', {
        requestId,
        providerCode,
        message: err.message || null,
      });

      if (providerCode === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Não foi possível concluir o cadastro.', {
          error: 'USER_ALREADY_EXISTS',
          requestId,
        });
      }
      if (providerCode === 'auth/invalid-password') {
        throw new HttpsError('invalid-argument', 'Não foi possível concluir o cadastro.', {
          error: 'WEAK_PASSWORD',
          requestId,
        });
      }
      if (providerCode === 'auth/too-many-requests') {
        throw new HttpsError('resource-exhausted', 'Não foi possível concluir o cadastro.', {
          error: 'RATE_LIMITED',
          requestId,
        });
      }

      throw new HttpsError('internal', 'Não foi possível concluir o cadastro.', {
        error: 'REGISTER_FAILED',
        requestId,
      });
    }
  }
);

