export const COOKIE_POLICY_VERSION = '1.0';
export const COOKIE_CONSENT_STORAGE_KEY = 'cookie_consent';
export const COOKIE_CONSENT_ANON_ID_KEY = 'cookie_consent_anon_id';
export const COOKIE_CONSENT_OPEN_SETTINGS_EVENT = 'cpc:open-cookie-settings';

export type CookieConsentCategories = {
  necessary: true;
  analytics: boolean;
  personalization: boolean;
  externalServices: boolean;
};

export type CookieConsentRecord = CookieConsentCategories & {
  consentDate: string;
  policyVersion: string;
  anonymizedId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getOrCreateAnonymizedId(): string {
  if (typeof window === 'undefined') return 'anonymous';

  const existing = window.localStorage.getItem(COOKIE_CONSENT_ANON_ID_KEY);
  if (existing) return existing;

  const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(COOKIE_CONSENT_ANON_ID_KEY, created);
  return created;
}

export function defaultCookieConsentCategories(): CookieConsentCategories {
  return {
    necessary: true,
    analytics: false,
    personalization: false,
    externalServices: false,
  };
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const necessary = parsed.necessary === true;
    const analytics = parsed.analytics === true;
    const personalization = parsed.personalization === true;
    const externalServices = parsed.externalServices === true;
    const consentDate = typeof parsed.consentDate === 'string' ? parsed.consentDate : null;
    const policyVersion = typeof parsed.policyVersion === 'string' ? parsed.policyVersion : null;
    const anonymizedId = typeof parsed.anonymizedId === 'string' ? parsed.anonymizedId : null;

    if (!necessary || !consentDate || !policyVersion || !anonymizedId) return null;

    return {
      necessary: true,
      analytics,
      personalization,
      externalServices,
      consentDate,
      policyVersion,
      anonymizedId,
    };
  } catch {
    return null;
  }
}

export function writeCookieConsent(categories: Omit<CookieConsentCategories, 'necessary'> & Partial<Pick<CookieConsentCategories, 'necessary'>>): CookieConsentRecord {
  if (typeof window === 'undefined') {
    return {
      ...defaultCookieConsentCategories(),
      ...categories,
      necessary: true,
      consentDate: new Date().toISOString().slice(0, 10),
      policyVersion: COOKIE_POLICY_VERSION,
      anonymizedId: 'anonymous',
    };
  }

  const record: CookieConsentRecord = {
    ...defaultCookieConsentCategories(),
    ...categories,
    necessary: true,
    consentDate: new Date().toISOString().slice(0, 10),
    policyVersion: COOKIE_POLICY_VERSION,
    anonymizedId: getOrCreateAnonymizedId(),
  };

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  window.dispatchEvent(new Event('cpc:cookie-consent-changed'));
  return record;
}

export function needsCookieConsentPrompt(): boolean {
  const existing = readCookieConsent();
  if (!existing) return true;
  return existing.policyVersion !== COOKIE_POLICY_VERSION;
}

export function isCookieCategoryAllowed(category: keyof CookieConsentCategories): boolean {
  const consent = readCookieConsent();
  if (!consent) return category === 'necessary';
  if (consent.policyVersion !== COOKIE_POLICY_VERSION) return category === 'necessary';
  return consent[category] === true;
}
